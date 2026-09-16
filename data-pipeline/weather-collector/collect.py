#!/usr/bin/env python3
"""Collect Daejeon ultra-short-term weather observations from KMA."""

from __future__ import annotations

import argparse
import json
import logging
import os
import signal
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import unquote
from zoneinfo import ZoneInfo

import pyarrow as pa
import pyarrow.parquet as pq
import requests

from kafka_publisher import WeatherKafkaError, WeatherKafkaOutbox, WeatherKafkaPublisher


API_URL = (
    "https://apis.data.go.kr/1360000/"
    "VilageFcstInfoService_2.0/getUltraSrtNcst"
)
KST = ZoneInfo("Asia/Seoul")
REQUEST_TIMEOUT = (5, 20)
MAX_ATTEMPTS = 3


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be greater than zero")
    return value


def _env_path(name: str, default: str) -> Path:
    return Path(os.environ.get(name, "").strip() or default)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name, str(default)).strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} must be true or false")


DATA_ROOT = _env_path("WEATHER_DATA_DIR", "data")
OBSERVATION_ROOT = DATA_ROOT / "observations"
HEALTH_PATH = _env_path("WEATHER_HEALTH_PATH", "health.json")
LATEST_PATH = DATA_ROOT / "latest.json"


class WeatherApiError(RuntimeError):
    """Represent an HTTP, protocol, or KMA response error."""


@dataclass(frozen=True)
class WeatherObservation:
    observed_at: datetime
    fetched_at: datetime
    nx: int
    ny: int
    temperature: float
    rainfall_1h: float
    source: str = "KMA_GET_ULTRA_SRT_NCST"

    def json_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["observed_at"] = self.observed_at.isoformat()
        payload["fetched_at"] = self.fetched_at.isoformat()
        return payload


PARQUET_SCHEMA = pa.schema(
    [
        pa.field("observed_at", pa.timestamp("ns", tz="Asia/Seoul"), nullable=False),
        pa.field("fetched_at", pa.timestamp("ns", tz="Asia/Seoul"), nullable=False),
        pa.field("nx", pa.int32(), nullable=False),
        pa.field("ny", pa.int32(), nullable=False),
        pa.field("temperature", pa.float64(), nullable=False),
        pa.field("rainfall_1h", pa.float64(), nullable=False),
        pa.field("source", pa.string(), nullable=False),
    ]
)


def available_observation_time(now: datetime, release_minute: int = 40) -> datetime:
    """Return the newest observation that should have been published by ``now``."""
    now_kst = now.astimezone(KST)
    hour = now_kst.replace(minute=0, second=0, microsecond=0)
    if now_kst.minute < release_minute:
        hour -= timedelta(hours=1)
    return hour


def _parse_number(value: Any, *, category: str) -> float:
    text = str(value).strip()
    if category == "RN1" and text in {"강수없음", "없음"}:
        return 0.0
    try:
        return float(text)
    except (TypeError, ValueError) as exc:
        raise WeatherApiError(f"invalid {category} value: {text!r}") from exc


def parse_observation(
    payload: dict[str, Any], *, target: datetime, fetched_at: datetime, nx: int, ny: int
) -> WeatherObservation:
    response = payload.get("response") or {}
    header = response.get("header") or {}
    code = str(header.get("resultCode", ""))
    if code != "00":
        message = str(header.get("resultMsg") or "메시지 없음")
        raise WeatherApiError(f"api_error: resultCode={code!r}, message={message!r}")

    body = response.get("body") or {}
    items_wrapper = body.get("items") or {}
    items = items_wrapper.get("item") or []
    if isinstance(items, dict):
        items = [items]
    if not isinstance(items, list):
        raise WeatherApiError("invalid_body: response.body.items.item is not a list")

    expected_date = target.strftime("%Y%m%d")
    expected_time = target.strftime("%H%M")
    values: dict[str, float] = {}
    for item in items:
        if str(item.get("baseDate", "")) != expected_date:
            continue
        if str(item.get("baseTime", "")).zfill(4) != expected_time:
            continue
        category = str(item.get("category", ""))
        if category in {"T1H", "RN1"}:
            values[category] = _parse_number(item.get("obsrValue"), category=category)

    missing = sorted({"T1H", "RN1"} - values.keys())
    if missing:
        raise WeatherApiError(f"observation categories missing: {', '.join(missing)}")

    return WeatherObservation(
        observed_at=target,
        fetched_at=fetched_at,
        nx=nx,
        ny=ny,
        temperature=values["T1H"],
        rainfall_1h=values["RN1"],
    )


def _atomic_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


class WeatherCollector:
    def __init__(self) -> None:
        raw_key = os.environ.get("KMA_API_KEY", "").strip()
        if not raw_key:
            raise RuntimeError("환경변수 KMA_API_KEY가 필요합니다")
        self.api_key = unquote(raw_key)
        self.nx = _env_int("KMA_NX", 67)
        self.ny = _env_int("KMA_NY", 100)
        self.interval_seconds = _env_int("WEATHER_INTERVAL_SECONDS", 300)
        self.release_minute = _env_int("WEATHER_RELEASE_MINUTE", 40)
        if self.release_minute >= 60:
            raise RuntimeError("WEATHER_RELEASE_MINUTE must be less than 60")
        self.session = requests.Session()
        self.stop_requested = False
        self.kafka_enabled = _env_bool("WEATHER_KAFKA_ENABLED", False)
        self.kafka_outbox: WeatherKafkaOutbox | None = None
        if self.kafka_enabled:
            publisher = WeatherKafkaPublisher.from_env()
            spool_dir = _env_path(
                "WEATHER_KAFKA_SPOOL_DIR", str(DATA_ROOT / "kafka-spool")
            )
            self.kafka_outbox = WeatherKafkaOutbox(publisher, spool_dir)

    def fetch(self, now: datetime | None = None) -> WeatherObservation:
        fetched_at = now.astimezone(KST) if now else datetime.now(KST)
        target = available_observation_time(fetched_at, self.release_minute)
        params = {
            "serviceKey": self.api_key,
            "pageNo": 1,
            "numOfRows": 1000,
            "dataType": "JSON",
            "base_date": target.strftime("%Y%m%d"),
            "base_time": target.strftime("%H%M"),
            "nx": self.nx,
            "ny": self.ny,
        }
        try:
            response = self.session.get(API_URL, params=params, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as exc:
            status = getattr(exc.response, "status_code", None)
            raise WeatherApiError(
                f"http_error: status={status}, kind={type(exc).__name__}"
            ) from exc
        except ValueError as exc:
            raise WeatherApiError("invalid_json") from exc

        try:
            return parse_observation(
                payload, target=target, fetched_at=fetched_at, nx=self.nx, ny=self.ny
            )
        except WeatherApiError as exc:
            safe_message = str(exc).replace(self.api_key, "[redacted]")
            raise WeatherApiError(safe_message) from exc

    @staticmethod
    def _observation_path(observation: WeatherObservation) -> Path:
        day = observation.observed_at.strftime("%Y-%m-%d")
        stamp = observation.observed_at.strftime("%H%M")
        return (
            OBSERVATION_ROOT
            / f"dt={day}"
            / f"weather-{stamp}-nx{observation.nx}-ny{observation.ny}.parquet"
        )

    def save(self, observation: WeatherObservation) -> tuple[Path, bool]:
        path = self._observation_path(observation)
        path.parent.mkdir(parents=True, exist_ok=True)
        created = not path.exists()
        if created:
            temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
            table = pa.Table.from_pylist([asdict(observation)], schema=PARQUET_SCHEMA)
            pq.write_table(table, temporary, compression="snappy")
            os.replace(temporary, path)
        _atomic_json(LATEST_PATH, observation.json_dict())
        return path, created

    def _update_health(
        self, observation: WeatherObservation, path: Path, created: bool
    ) -> None:
        kafka_pending = (
            self.kafka_outbox.pending_count() if self.kafka_outbox is not None else 0
        )
        _atomic_json(
            HEALTH_PATH,
            {
                "status": "ok",
                "observed_at": observation.observed_at.isoformat(),
                "fetched_at": observation.fetched_at.isoformat(),
                "temperature": observation.temperature,
                "rainfall_1h": observation.rainfall_1h,
                "path": str(path),
                "new_file": created,
                "kafka_enabled": self.kafka_enabled,
                "kafka_pending_events": kafka_pending,
            },
        )

    def _replay_kafka(self) -> None:
        if self.kafka_outbox is None:
            return
        try:
            result = self.kafka_outbox.replay_pending()
            if result.delivered_events:
                logging.info(
                    "weather Kafka replay delivered=%d pending=%d",
                    result.delivered_events,
                    result.pending_events,
                )
        except WeatherKafkaError:
            logging.exception(
                "weather Kafka replay failed pending=%d",
                self.kafka_outbox.pending_count(),
            )

    def _enqueue_kafka(self, observation: WeatherObservation, created: bool) -> None:
        if self.kafka_outbox is None or not created:
            return
        try:
            path = self.kafka_outbox.enqueue(observation)
            logging.info(
                "weather Kafka spool saved event_id=%s path=%s",
                f"{observation.observed_at.isoformat()}:{observation.nx}:{observation.ny}",
                path,
            )
        except WeatherKafkaError:
            logging.exception("weather Kafka spool save failed")
            return
        self._replay_kafka()

    def collect_once(self, now: datetime | None = None) -> WeatherObservation:
        self._replay_kafka()
        last_error: Exception | None = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                observation = self.fetch(now)
                path, created = self.save(observation)
                self._enqueue_kafka(observation, created)
                self._update_health(observation, path, created)
                logging.info(
                    "weather collected observed_at=%s temperature=%.1f rainfall_1h=%.1f new_file=%s",
                    observation.observed_at.isoformat(),
                    observation.temperature,
                    observation.rainfall_1h,
                    created,
                )
                return observation
            except WeatherApiError as exc:
                last_error = exc
                logging.warning("weather collection failed attempt=%d/%d: %s", attempt, MAX_ATTEMPTS, exc)
                if attempt < MAX_ATTEMPTS:
                    time.sleep(2 ** (attempt - 1))
        raise WeatherApiError(str(last_error) if last_error else "weather collection failed")

    def run(self) -> None:
        while not self.stop_requested:
            started = time.monotonic()
            try:
                self.collect_once()
            except WeatherApiError:
                logging.exception("weather collection cycle failed")
            remaining = max(0.0, self.interval_seconds - (time.monotonic() - started))
            end = time.monotonic() + remaining
            while not self.stop_requested and time.monotonic() < end:
                time.sleep(min(1.0, end - time.monotonic()))

    def close(self) -> None:
        self.session.close()
        if self.kafka_outbox is not None:
            self.kafka_outbox.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="collect one observation and exit")
    args = parser.parse_args()
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")

    collector = WeatherCollector()

    def request_stop(_signum: int, _frame: Any) -> None:
        collector.stop_requested = True

    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)
    try:
        if args.once:
            collector.collect_once()
        else:
            collector.run()
        return 0
    finally:
        collector.close()


if __name__ == "__main__":
    raise SystemExit(main())
