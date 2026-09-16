"""Publish normalized weather observations to Kafka with a durable outbox."""

from __future__ import annotations

import json
import os
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


DEFAULT_BOOTSTRAP_SERVERS = "localhost:9092"
DEFAULT_TOPIC = "tashu.weather-observation.v1"


class WeatherKafkaError(RuntimeError):
    """Raised when a weather event cannot be serialized or delivered."""


@dataclass(frozen=True)
class ReplayResult:
    delivered_events: int
    pending_events: int


def _aware_isoformat(value: Any, *, field: str) -> str:
    if not isinstance(value, datetime):
        raise WeatherKafkaError(f"{field} must be a datetime")
    if value.tzinfo is None:
        raise WeatherKafkaError(f"{field} must include a timezone")
    return value.isoformat()


def event_id_for(observation: Any) -> str:
    observed_at = _aware_isoformat(observation.observed_at, field="observed_at")
    return f"{observed_at}:{int(observation.nx)}:{int(observation.ny)}"


def message_for_observation(observation: Any) -> tuple[bytes, bytes]:
    """Serialize one observation using the agreed AI/Data event contract."""
    observed_at = _aware_isoformat(observation.observed_at, field="observed_at")
    fetched_at = _aware_isoformat(observation.fetched_at, field="fetched_at")
    nx = int(observation.nx)
    ny = int(observation.ny)
    payload = {
        "schema_version": 1,
        "event_id": f"{observed_at}:{nx}:{ny}",
        "observed_at": observed_at,
        "fetched_at": fetched_at,
        "nx": nx,
        "ny": ny,
        "temperature": float(observation.temperature),
        "rainfall_1h": float(observation.rainfall_1h),
        "source": str(observation.source),
    }
    key = f"{nx}:{ny}".encode("utf-8")
    value = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(
        "utf-8"
    )
    return key, value


class WeatherKafkaPublisher:
    def __init__(
        self,
        bootstrap_servers: str = DEFAULT_BOOTSTRAP_SERVERS,
        topic: str = DEFAULT_TOPIC,
        *,
        client_id: str = "tashu-weather-collector",
        delivery_timeout_seconds: float = 10.0,
        producer: Any | None = None,
    ) -> None:
        if not bootstrap_servers.strip():
            raise ValueError("bootstrap_servers must not be empty")
        if not topic.strip():
            raise ValueError("topic must not be empty")
        if delivery_timeout_seconds <= 0:
            raise ValueError("delivery_timeout_seconds must be greater than zero")

        self.topic = topic
        self.delivery_timeout_seconds = delivery_timeout_seconds
        if producer is None:
            try:
                from confluent_kafka import Producer
            except ImportError as exc:
                raise RuntimeError(
                    "confluent-kafka is required when WEATHER_KAFKA_ENABLED=true"
                ) from exc
            producer = Producer(
                {
                    "bootstrap.servers": bootstrap_servers,
                    "client.id": client_id,
                    "acks": "all",
                    "enable.idempotence": True,
                    "delivery.timeout.ms": int(delivery_timeout_seconds * 1000),
                    "linger.ms": 20,
                }
            )
        self.producer = producer

    @classmethod
    def from_env(cls) -> "WeatherKafkaPublisher":
        raw_timeout = os.environ.get(
            "WEATHER_KAFKA_DELIVERY_TIMEOUT_SECONDS", "10"
        ).strip()
        try:
            timeout = float(raw_timeout)
        except ValueError as exc:
            raise RuntimeError(
                "WEATHER_KAFKA_DELIVERY_TIMEOUT_SECONDS must be a number"
            ) from exc
        return cls(
            bootstrap_servers=os.environ.get(
                "WEATHER_KAFKA_BOOTSTRAP_SERVERS", DEFAULT_BOOTSTRAP_SERVERS
            ),
            topic=os.environ.get("WEATHER_KAFKA_TOPIC", DEFAULT_TOPIC),
            client_id=os.environ.get(
                "WEATHER_KAFKA_CLIENT_ID", "tashu-weather-collector"
            ),
            delivery_timeout_seconds=timeout,
        )

    def publish_message(self, key: bytes, value: bytes) -> None:
        delivery_errors: list[str] = []

        def delivery_report(error: Any, _message: Any) -> None:
            if error is not None:
                delivery_errors.append(str(error))

        while True:
            try:
                self.producer.produce(
                    self.topic, key=key, value=value, on_delivery=delivery_report
                )
                break
            except BufferError:
                self.producer.poll(1.0)
        self.producer.poll(0)

        undelivered = self.producer.flush(self.delivery_timeout_seconds)
        if undelivered or delivery_errors:
            detail = delivery_errors[0] if delivery_errors else "delivery timeout"
            raise WeatherKafkaError(
                f"weather delivery failed: undelivered={undelivered}, error={detail}"
            )

    def close(self) -> None:
        self.producer.flush(self.delivery_timeout_seconds)


class WeatherKafkaOutbox:
    """Persist events before delivery and replay them oldest-first."""

    def __init__(self, publisher: WeatherKafkaPublisher, spool_dir: Path | str) -> None:
        self.publisher = publisher
        self.spool_dir = Path(spool_dir)

    def enqueue(self, observation: Any) -> Path:
        key, value = message_for_observation(observation)
        payload = {
            "spool_version": 1,
            "topic": self.publisher.topic,
            "event_id": event_id_for(observation),
            "key": key.decode("utf-8"),
            "value": value.decode("utf-8"),
        }
        try:
            self.spool_dir.mkdir(parents=True, exist_ok=True)
            final = self.spool_dir / f"{time.time_ns():020d}-{uuid.uuid4().hex}.json"
            temporary = final.with_suffix(".json.tmp")
            with temporary.open("w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, final)
            return final
        except OSError as exc:
            raise WeatherKafkaError("failed to persist weather Kafka spool") from exc

    def _load(self, path: Path) -> tuple[bytes, bytes]:
        try:
            with path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
            if payload.get("spool_version") != 1:
                raise ValueError("unsupported spool version")
            if payload.get("topic") != self.publisher.topic:
                raise ValueError("spool topic does not match configured topic")
            return (
                str(payload["key"]).encode("utf-8"),
                str(payload["value"]).encode("utf-8"),
            )
        except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise WeatherKafkaError(f"invalid weather spool file: {path}") from exc

    def pending_count(self) -> int:
        if not self.spool_dir.exists():
            return 0
        return sum(1 for _ in self.spool_dir.glob("*.json"))

    def replay_pending(self) -> ReplayResult:
        delivered = 0
        if self.spool_dir.exists():
            for path in sorted(self.spool_dir.glob("*.json")):
                key, value = self._load(path)
                self.publisher.publish_message(key, value)
                path.unlink()
                delivered += 1
        return ReplayResult(
            delivered_events=delivered,
            pending_events=self.pending_count(),
        )

    def close(self) -> None:
        self.publisher.close()
