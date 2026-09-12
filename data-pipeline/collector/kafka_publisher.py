"""Publish validated Tashu station snapshots to Kafka."""

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
DEFAULT_TOPIC = "tashu.station-availability.v1"
REQUIRED_COLUMNS = (
    "collected_at",
    "station_id",
    "station_name",
    "lat",
    "lon",
    "bikes",
)


class KafkaPublishError(RuntimeError):
    """Raised when a complete snapshot cannot be delivered to Kafka."""


@dataclass(frozen=True)
class PublishResult:
    """Summary of one successfully delivered snapshot."""

    snapshot_id: str
    message_count: int


@dataclass(frozen=True)
class ReplayResult:
    """Summary of one FIFO spool replay attempt."""

    delivered_snapshots: int
    delivered_messages: int
    pending_snapshots: int


def _isoformat(value: Any) -> str:
    """Convert pandas/Python datetime values to an ISO-8601 string."""
    if hasattr(value, "to_pydatetime"):
        value = value.to_pydatetime()
    if not isinstance(value, datetime):
        raise KafkaPublishError("collected_at must be a datetime")
    if value.tzinfo is None:
        raise KafkaPublishError("collected_at must include a timezone")
    return value.isoformat()


class KafkaPublisher:
    """Send one Kafka message per station in a validated snapshot."""

    def __init__(
        self,
        bootstrap_servers: str = DEFAULT_BOOTSTRAP_SERVERS,
        topic: str = DEFAULT_TOPIC,
        *,
        client_id: str = "tashu-collector",
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
                    "confluent-kafka is required; install collector requirements first"
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
    def from_env(cls) -> "KafkaPublisher":
        """Build a publisher from non-secret environment settings."""
        timeout_raw = os.environ.get("TASHU_KAFKA_DELIVERY_TIMEOUT_SECONDS", "10").strip()
        try:
            timeout = float(timeout_raw)
        except ValueError as exc:
            raise RuntimeError(
                "TASHU_KAFKA_DELIVERY_TIMEOUT_SECONDS must be a number"
            ) from exc

        return cls(
            bootstrap_servers=os.environ.get(
                "TASHU_KAFKA_BOOTSTRAP_SERVERS", DEFAULT_BOOTSTRAP_SERVERS
            ),
            topic=os.environ.get("TASHU_KAFKA_TOPIC", DEFAULT_TOPIC),
            client_id=os.environ.get("TASHU_KAFKA_CLIENT_ID", "tashu-collector"),
            delivery_timeout_seconds=timeout,
        )

    @staticmethod
    def messages_for_snapshot(frame: Any, snapshot_id: str) -> list[tuple[bytes, bytes]]:
        """Validate and serialize the full snapshot before sending any row."""
        missing = [name for name in REQUIRED_COLUMNS if name not in frame.columns]
        if missing:
            raise KafkaPublishError(f"snapshot columns missing: {', '.join(missing)}")

        records = frame.to_dict(orient="records")
        if not records:
            raise KafkaPublishError("snapshot must contain at least one station")

        station_count = len(records)
        messages: list[tuple[bytes, bytes]] = []
        collected_at_values: set[str] = set()
        station_ids: set[str] = set()

        for record in records:
            station_id = str(record["station_id"])
            collected_at = _isoformat(record["collected_at"])
            if not station_id:
                raise KafkaPublishError("station_id must not be empty")
            if station_id in station_ids:
                raise KafkaPublishError(f"duplicate station_id: {station_id}")

            station_ids.add(station_id)
            collected_at_values.add(collected_at)
            value = {
                "schema_version": 1,
                "event_id": f"{snapshot_id}:{station_id}",
                "snapshot_id": snapshot_id,
                "station_count": station_count,
                "collected_at": collected_at,
                "station_id": station_id,
                "station_name": str(record["station_name"]),
                "lat": float(record["lat"]),
                "lon": float(record["lon"]),
                "bikes": int(record["bikes"]),
            }
            messages.append(
                (
                    station_id.encode("utf-8"),
                    json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode(
                        "utf-8"
                    ),
                )
            )

        if len(collected_at_values) != 1:
            raise KafkaPublishError("all stations must share one collected_at value")
        return messages

    def publish_snapshot(
        self, frame: Any, *, snapshot_id: str | None = None
    ) -> PublishResult:
        """Synchronously deliver every station message for one snapshot."""
        snapshot_id = snapshot_id or str(uuid.uuid4())
        messages = self.messages_for_snapshot(frame, snapshot_id)
        self.publish_messages(messages)
        return PublishResult(snapshot_id=snapshot_id, message_count=len(messages))

    def publish_messages(self, messages: list[tuple[bytes, bytes]]) -> None:
        """Synchronously deliver an already serialized snapshot batch."""
        if not messages:
            raise KafkaPublishError("snapshot must contain at least one message")
        delivery_errors: list[str] = []

        def delivery_report(error: Any, _message: Any) -> None:
            if error is not None:
                delivery_errors.append(str(error))

        for key, value in messages:
            while True:
                try:
                    self.producer.produce(
                        self.topic,
                        key=key,
                        value=value,
                        on_delivery=delivery_report,
                    )
                    break
                except BufferError:
                    self.producer.poll(1.0)
            self.producer.poll(0)

        undelivered = self.producer.flush(self.delivery_timeout_seconds)
        if undelivered or delivery_errors:
            detail = delivery_errors[0] if delivery_errors else "delivery timeout"
            raise KafkaPublishError(
                f"snapshot delivery failed: undelivered={undelivered}, error={detail}"
            )

    def close(self) -> None:
        """Wait briefly for queued messages during shutdown."""
        self.producer.flush(self.delivery_timeout_seconds)


class KafkaOutbox:
    """Durably spool complete snapshot batches and replay them oldest-first."""

    def __init__(self, publisher: KafkaPublisher, spool_dir: Path | str) -> None:
        self.publisher = publisher
        self.spool_dir = Path(spool_dir)

    def enqueue_snapshot(self, frame: Any, snapshot_id: str) -> Path:
        """Atomically persist a validated Kafka batch before attempting delivery."""
        messages = self.publisher.messages_for_snapshot(frame, snapshot_id)
        payload = {
            "spool_version": 1,
            "topic": self.publisher.topic,
            "snapshot_id": snapshot_id,
            "message_count": len(messages),
            "messages": [
                {"key": key.decode("utf-8"), "value": value.decode("utf-8")}
                for key, value in messages
            ],
        }
        self.spool_dir.mkdir(parents=True, exist_ok=True)
        final = self.spool_dir / f"{time.time_ns():020d}-{uuid.uuid4().hex}.json"
        temporary = final.with_suffix(".json.tmp")
        with temporary.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, final)
        return final

    def _load(self, path: Path) -> list[tuple[bytes, bytes]]:
        try:
            with path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
            if payload.get("spool_version") != 1:
                raise ValueError("unsupported spool version")
            if payload.get("topic") != self.publisher.topic:
                raise ValueError("spool topic does not match configured topic")
            raw_messages = payload["messages"]
            if len(raw_messages) != int(payload["message_count"]):
                raise ValueError("spool message count mismatch")
            return [
                (
                    str(message["key"]).encode("utf-8"),
                    str(message["value"]).encode("utf-8"),
                )
                for message in raw_messages
            ]
        except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise KafkaPublishError(f"invalid Kafka spool file: {path}") from exc

    def pending_count(self) -> int:
        if not self.spool_dir.exists():
            return 0
        return sum(1 for _ in self.spool_dir.glob("*.json"))

    def replay_pending(self) -> ReplayResult:
        """Deliver complete batches in FIFO order, stopping at the first failure."""
        delivered_snapshots = 0
        delivered_messages = 0
        if self.spool_dir.exists():
            for path in sorted(self.spool_dir.glob("*.json")):
                messages = self._load(path)
                self.publisher.publish_messages(messages)
                path.unlink()
                delivered_snapshots += 1
                delivered_messages += len(messages)
        return ReplayResult(
            delivered_snapshots=delivered_snapshots,
            delivered_messages=delivered_messages,
            pending_snapshots=self.pending_count(),
        )

    def close(self) -> None:
        self.publisher.close()
