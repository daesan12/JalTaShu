#!/usr/bin/env python3
"""Collect complete Tashu station snapshots into restart-safe Parquet parts."""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import random
import signal
import sys
import time
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import unquote
from zoneinfo import ZoneInfo

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import requests

from kafka_publisher import KafkaOutbox, KafkaPublishError, KafkaPublisher
from redis_publisher import RedisPublishError, RedisSnapshotPublisher


API_URL = "https://apis.data.go.kr/B551982/pbdo_v2/inf_101_00010002_v2"
KST = ZoneInfo("Asia/Seoul")
PAGE_SIZE = 1000
MAX_PAGE_ATTEMPTS = 3
MAX_SNAPSHOT_ATTEMPTS = 3
FLUSH_SECONDS = 300
DAILY_CALL_LIMIT = 4500
REQUEST_TIMEOUT = (5, 20)


def _env_int(name: str, default: int) -> int:
    """Read a positive integer environment setting."""
    raw = os.environ.get(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be greater than zero")
    return value


def _env_bool(name: str, default: bool) -> bool:
    """Read a conventional true/false environment setting."""
    raw = os.environ.get(name, str(default).lower()).strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} must be true or false")


def _env_path(name: str, default: str) -> Path:
    """Treat an empty optional path setting as its documented default."""
    return Path(os.environ.get(name, "").strip() or default)


INTERVAL_SECONDS = _env_int("TASHU_INTERVAL_SECONDS", 45)
DATA_ROOT = _env_path("TASHU_DATA_DIR", "data")
SNAPSHOT_ROOT = DATA_ROOT / "snapshots"
CSV_ROOT = DATA_ROOT / "csv"
STATE_DIR = DATA_ROOT / "state"
HEALTH_PATH = _env_path("TASHU_HEALTH_PATH", "health.json")
STATE_PATH = STATE_DIR / "collector_state.json"

PARQUET_SCHEMA = pa.schema(
    [
        pa.field("collected_at", pa.timestamp("ns", tz="Asia/Seoul"), nullable=False),
        pa.field("station_id", pa.string(), nullable=False),
        pa.field("station_name", pa.string(), nullable=False),
        pa.field("lat", pa.float64(), nullable=False),
        pa.field("lon", pa.float64(), nullable=False),
        pa.field("bikes", pa.int64(), nullable=False),
    ]
)


class ApiError(RuntimeError):
    """Represent an HTTP, protocol, validation, or public-API failure."""

    def __init__(self, message: str, *, code: str | None = None, retryable: bool = True) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable


class KstFormatter(logging.Formatter):
    """Render log timestamps as explicit Asia/Seoul ISO-8601 values."""

    def formatTime(self, record: logging.LogRecord, datefmt: str | None = None) -> str:
        value = datetime.fromtimestamp(record.created, KST)
        return value.strftime(datefmt) if datefmt else value.isoformat(timespec="seconds")


def _backoff_sleep(attempt: int) -> None:
    """Apply exponential backoff with small jitter (attempt is one-based)."""
    delay = min(30.0, 2 ** (attempt - 1)) + random.uniform(0.0, 0.5)
    time.sleep(delay)


class Collector:
    """Own collector configuration, persistent counters, and polling state."""

    def __init__(self) -> None:
        primary = os.environ.get("TASHU_API_KEY", "").strip()
        fallback = os.environ.get("TASHU_API_KEY_FALLBACK", "").strip()
        if not primary:
            raise RuntimeError("환경변수 TASHU_API_KEY가 필요합니다")
        primary = unquote(primary)
        fallback = unquote(fallback)
        self.api_keys = [primary] + ([fallback] if fallback and fallback != primary else [])
        self.key_labels = ["primary"] + (["fallback"] if len(self.api_keys) == 2 else [])
        self.interval_seconds = _env_int("TASHU_INTERVAL_SECONDS", 45)
        self.write_csv = _env_bool("TASHU_WRITE_CSV", False)
        self.kafka_enabled = _env_bool("TASHU_KAFKA_ENABLED", False)
        self.redis_enabled = _env_bool("TASHU_REDIS_ENABLED", False)
        self.webhook_url = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
        self.session = requests.Session()
        self.stop_requested = False
        self.buffer: list[pd.DataFrame] = []
        self.last_flush = time.monotonic()
        self.consecutive_failures = 0
        self.failure_alert_sent = False
        self.state = self._load_state()
        self.kafka_outbox: KafkaOutbox | None = None
        self.redis_publisher: RedisSnapshotPublisher | None = None
        if self.kafka_enabled:
            spool_dir = _env_path(
                "TASHU_KAFKA_SPOOL_DIR", str(DATA_ROOT / "kafka-spool")
            )
            self.kafka_outbox = KafkaOutbox(KafkaPublisher.from_env(), spool_dir)
        if self.redis_enabled:
            self.redis_publisher = RedisSnapshotPublisher.from_env()

    def _load_state(self) -> dict[str, Any]:
        default: dict[str, Any] = {"calls": {}, "stats": {}, "last_summary_date": None}
        try:
            with STATE_PATH.open("r", encoding="utf-8") as handle:
                loaded = json.load(handle)
            if not isinstance(loaded, dict):
                raise TypeError("state root is not an object")
            for key, value in default.items():
                loaded.setdefault(key, value)
            # Migrate the previous aggregate daily counter without discarding it.
            loaded["calls"] = {
                day: ({"primary": int(count)} if not isinstance(count, dict) else count)
                for day, count in loaded["calls"].items()
            }
            return loaded
        except FileNotFoundError:
            return default
        except (OSError, ValueError, TypeError) as exc:
            raise RuntimeError(f"상태 파일을 안전하게 읽을 수 없습니다: {STATE_PATH}") from exc

    @staticmethod
    def _atomic_json(path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(
            f".{path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp"
        )
        with temporary.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        for attempt in range(5):
            try:
                os.replace(temporary, path)
                break
            except PermissionError:
                if attempt == 4:
                    raise
                # Windows antivirus/indexers can briefly hold the destination.
                time.sleep(0.02 * (attempt + 1))

    def _save_state(self) -> None:
        self._atomic_json(STATE_PATH, self.state)

    def _reserve_api_call(self, key_index: int, now: datetime) -> None:
        """Durably count one key's call immediately before the HTTP request."""
        day = now.date().isoformat()
        label = self.key_labels[key_index]
        calls = self.state["calls"].setdefault(day, {})
        used = int(calls.get(label, 0))
        if used >= DAILY_CALL_LIMIT:
            raise ApiError(
                f"daily_call_limit: {label} {day} 호출 {used}/{DAILY_CALL_LIMIT}",
                code="DAILY_LIMIT",
                retryable=False,
            )
        calls[label] = used + 1
        self._prune_state(now.date())
        self._save_state()

    def _prune_state(self, today: date) -> None:
        cutoff = (today - timedelta(days=14)).isoformat()
        self.state["calls"] = {k: v for k, v in self.state["calls"].items() if k >= cutoff}
        self.state["stats"] = {k: v for k, v in self.state["stats"].items() if k >= cutoff}

    def _request_page(
        self, key_index: int, page_no: int
    ) -> tuple[datetime, int, list[dict[str, Any]]]:
        called_at = datetime.now(KST)
        self._reserve_api_call(key_index, called_at)
        params = {
            "serviceKey": self.api_keys[key_index],
            "pageNo": page_no,
            "numOfRows": PAGE_SIZE,
            "type": "json",
            "lcgvmnInstCd": "3000000000",
        }
        try:
            response = self.session.get(API_URL, params=params, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
        except requests.RequestException as exc:
            status = getattr(exc.response, "status_code", None)
            raise ApiError(f"http_error: status={status}, kind={type(exc).__name__}") from exc
        try:
            payload = response.json()
        except ValueError as exc:
            raise ApiError(f"invalid_json: HTTP {response.status_code}") from exc

        header = payload.get("header") or {}
        result_code = str(header.get("resultCode", ""))
        if result_code != "K0":
            message = str(
                header.get("resultMsg") or header.get("resultMessage") or "메시지 없음"
            )
            for secret in self.api_keys:
                message = message.replace(secret, "[redacted]")
            raise ApiError(
                f"api_error: resultCode={result_code!r}, message={message!r}",
                code=result_code,
                retryable=result_code != "K10",
            )
        body = payload.get("body") or {}
        items = body.get("item") or []
        if isinstance(items, dict):
            items = [items]
        if not isinstance(items, list):
            raise ApiError("invalid_body: body.item이 배열이 아닙니다")
        try:
            total_count = int(body["totalCount"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ApiError("invalid_body: totalCount가 정수가 아닙니다") from exc
        if total_count < 0:
            raise ApiError("invalid_body: totalCount가 음수입니다")
        return called_at, total_count, items

    def _fetch_page(
        self, key_index: int, page_no: int
    ) -> tuple[datetime, int, list[dict[str, Any]]]:
        errors: list[str] = []
        for attempt in range(1, MAX_PAGE_ATTEMPTS + 1):
            try:
                return self._request_page(key_index, page_no)
            except ApiError as exc:
                errors.append(str(exc))
                logging.warning(
                    "페이지 수집 실패 page=%d attempt=%d/%d: %s",
                    page_no,
                    attempt,
                    MAX_PAGE_ATTEMPTS,
                    exc,
                )
                if not exc.retryable:
                    raise
                if attempt < MAX_PAGE_ATTEMPTS:
                    _backoff_sleep(attempt)
        raise ApiError("; ".join(errors), code="PAGE_RETRIES_EXHAUSTED")

    def _collect_with_key(self, key_index: int) -> pd.DataFrame:
        collected_at, expected_total, first_items = self._fetch_page(key_index, 1)
        page_count = max(1, math.ceil(expected_total / PAGE_SIZE))
        all_items = list(first_items)
        for page_no in range(2, page_count + 1):
            _called_at, page_total, page_items = self._fetch_page(key_index, page_no)
            if page_total != expected_total:
                raise ApiError(
                    f"total_count_mismatch: page=1 total={expected_total}, "
                    f"page={page_no} total={page_total}"
                )
            all_items.extend(page_items)

        station_ids = [str(item.get("rntstnId", "")) for item in all_items]
        unique_count = len(set(station_ids))
        if len(all_items) != expected_total:
            raise ApiError(
                f"incomplete_snapshot: totalCount={expected_total}, received={len(all_items)}"
            )
        if unique_count != len(station_ids):
            raise ApiError(
                f"duplicate_station: rows={len(station_ids)}, unique={unique_count}"
            )
        if unique_count != expected_total:
            raise ApiError(
                f"station_count_mismatch: totalCount={expected_total}, unique={unique_count}"
            )
        return self.normalize_snapshot(collected_at, all_items)

    def fetch_snapshot(self) -> pd.DataFrame:
        """Fetch a complete snapshot, retrying the whole snapshot when incomplete."""
        errors: list[str] = []
        preferred_key = 0
        for attempt in range(1, MAX_SNAPSHOT_ATTEMPTS + 1):
            try:
                return self._collect_with_key(preferred_key)
            except ApiError as exc:
                errors.append(str(exc))
                can_fallback = preferred_key == 0 and len(self.api_keys) > 1
                if can_fallback and exc.code in {
                    "K10",
                    "DAILY_LIMIT",
                    "PAGE_RETRIES_EXHAUSTED",
                }:
                    preferred_key = 1
                    logging.warning("기본 API key 사용 불가: fallback key로 전환")
                    continue
                logging.error(
                    "snapshot 수집 실패 attempt=%d/%d: %s",
                    attempt,
                    MAX_SNAPSHOT_ATTEMPTS,
                    exc,
                )
                if not exc.retryable:
                    raise
                if attempt < MAX_SNAPSHOT_ATTEMPTS:
                    _backoff_sleep(attempt)
        raise ApiError("; ".join(errors))

    @staticmethod
    def normalize_snapshot(collected_at: datetime, items: list[dict[str, Any]]) -> pd.DataFrame:
        rows = []
        for item in items:
            try:
                rows.append(
                    {
                        "collected_at": collected_at,
                        "station_id": str(item["rntstnId"]),
                        "station_name": str(item["rntstnNm"]),
                        "lat": float(item["lat"]),
                        "lon": float(item["lot"]),
                        "bikes": int(item["bcyclTpkctNocs"]),
                    }
                )
            except (KeyError, TypeError, ValueError) as exc:
                station = item.get("rntstnId")
                raise ApiError(f"invalid_item: station={station!r}, error={exc}") from exc
        frame = pd.DataFrame(rows, columns=PARQUET_SCHEMA.names)
        frame["collected_at"] = pd.to_datetime(frame["collected_at"], utc=True).dt.tz_convert(KST)
        return frame

    @staticmethod
    def _write_csv_part(frame: pd.DataFrame, day: date, stem: str) -> None:
        directory = CSV_ROOT / f"dt={day.isoformat()}"
        directory.mkdir(parents=True, exist_ok=True)
        final = directory / f"{stem}.csv"
        temporary = final.with_suffix(".csv.tmp")
        frame.to_csv(temporary, index=False, encoding="utf-8")
        os.replace(temporary, final)
        logging.info("CSV 저장 rows=%d path=%s", len(frame), final)

    def flush(self) -> int:
        """Atomically write buffered rows as immutable date-partitioned parts."""
        if not self.buffer:
            self.last_flush = time.monotonic()
            return 0
        combined = pd.concat(self.buffer, ignore_index=True)
        written = 0
        for day, frame in combined.groupby(combined["collected_at"].dt.date, sort=True):
            directory = SNAPSHOT_ROOT / f"dt={day.isoformat()}"
            directory.mkdir(parents=True, exist_ok=True)
            stem = f"snapshots-{frame['collected_at'].min().strftime('%H%M%S')}-{uuid.uuid4().hex}"
            final = directory / f"{stem}.parquet"
            temporary = final.with_suffix(".parquet.tmp")
            table = pa.Table.from_pandas(frame, schema=PARQUET_SCHEMA, preserve_index=False)
            pq.write_table(table, temporary, compression="snappy")
            os.replace(temporary, final)
            if self.write_csv:
                self._write_csv_part(frame, day, stem)
            written += len(frame)
            logging.info("Parquet 저장 rows=%d path=%s", len(frame), final)
        self.buffer.clear()
        self.last_flush = time.monotonic()
        return written

    def _update_health(self, collected_at: datetime, station_count: int) -> None:
        self._atomic_json(
            HEALTH_PATH,
            {
                "status": "ok",
                "last_success_at": collected_at.isoformat(),
                "station_count": station_count,
                "updated_at": datetime.now(KST).isoformat(),
            },
        )

    def _record_slot(self, day: date, success: bool, rows: int = 0) -> None:
        key = day.isoformat()
        stats = self.state["stats"].setdefault(key, {"attempted": 0, "succeeded": 0, "rows": 0})
        stats["attempted"] += 1
        if success:
            stats["succeeded"] += 1
            stats["rows"] += rows
        self._save_state()

    def notify_discord(self, message: str) -> None:
        if not self.webhook_url:
            logging.warning("DISCORD_WEBHOOK_URL 미설정: 알림 생략: %s", message)
            return
        try:
            response = requests.post(self.webhook_url, json={"content": message}, timeout=10)
            response.raise_for_status()
        except requests.RequestException as exc:
            logging.error("Discord 알림 전송 실패 kind=%s", type(exc).__name__)

    def _send_due_summary(self, now: datetime) -> None:
        yesterday = (now.date() - timedelta(days=1)).isoformat()
        if self.state.get("last_summary_date") == yesterday:
            return
        stats = self.state["stats"].get(yesterday, {"attempted": 0, "succeeded": 0, "rows": 0})
        attempted = int(stats.get("attempted", 0))
        succeeded = int(stats.get("succeeded", 0))
        rate = (succeeded / attempted * 100.0) if attempted else 0.0
        self.flush()
        rows = self._persisted_rows(yesterday)
        self.notify_discord(
            f"📊 타슈 {yesterday} 요약: 수집 {rows:,}행, "
            f"성공률 {rate:.2f}% ({succeeded}/{attempted} 슬롯)"
        )
        self.state["last_summary_date"] = yesterday
        self._save_state()

    @staticmethod
    def _persisted_rows(day: str) -> int:
        total = 0
        directory = SNAPSHOT_ROOT / f"dt={day}"
        for path in directory.glob("snapshots-*.parquet"):
            try:
                total += pq.ParquetFile(path).metadata.num_rows
            except Exception:
                logging.exception("요약 중 Parquet 메타데이터 읽기 실패: %s", path)
        return total

    def _sleep_until_next_slot(self) -> None:
        """Sleep to the next aligned wall-clock slot without accumulating drift."""
        now = datetime.now(KST)
        timestamp = now.timestamp()
        next_timestamp = (
            math.floor(timestamp / self.interval_seconds) + 1
        ) * self.interval_seconds
        time.sleep(max(0.0, next_timestamp - timestamp))

    def _replay_kafka(self) -> None:
        if self.kafka_outbox is None:
            return
        try:
            result = self.kafka_outbox.replay_pending()
        except (KafkaPublishError, OSError):
            logging.exception(
                "Kafka replay 실패: spool을 보존하고 다음 수집 때 재시도합니다"
            )
            return
        if result.delivered_snapshots:
            logging.info(
                "Kafka replay 성공 snapshots=%d messages=%d pending=%d",
                result.delivered_snapshots,
                result.delivered_messages,
                result.pending_snapshots,
            )

    def _enqueue_kafka(self, frame: pd.DataFrame, snapshot_id: str) -> None:
        if self.kafka_outbox is None:
            return
        try:
            path = self.kafka_outbox.enqueue_snapshot(frame, snapshot_id)
            logging.info(
                "Kafka spool 저장 snapshot_id=%s stations=%d path=%s",
                snapshot_id,
                len(frame),
                path,
            )
        except (KafkaPublishError, OSError):
            logging.exception("Kafka spool 저장 실패 snapshot_id=%s", snapshot_id)
            return
        self._replay_kafka()

    def _publish_redis(self, frame: pd.DataFrame, snapshot_id: str) -> None:
        if self.redis_publisher is None:
            return
        try:
            self.redis_publisher.publish(frame, snapshot_id)
        except RedisPublishError:
            # Parquet/Kafka 원본 수집은 Redis의 일시 장애와 독립적으로 계속한다.
            logging.exception(
                "Redis 최신 snapshot 반영 실패: 다음 수집 때 새 snapshot으로 재시도합니다"
            )
            return
        logging.info(
            "Redis 최신 snapshot 반영 성공 snapshot_id=%s stations=%d",
            snapshot_id,
            len(frame),
        )

    def request_stop(self, signum: int, _frame: Any) -> None:
        logging.info("종료 신호 수신 signal=%s", signum)
        self.stop_requested = True

    def _store_successful_snapshot(self, frame: pd.DataFrame, slot_day: date) -> None:
        collected_at = frame["collected_at"].iloc[0].to_pydatetime()
        snapshot_id = str(uuid.uuid4())
        self.buffer.append(frame)
        self._enqueue_kafka(frame, snapshot_id)
        self._publish_redis(frame, snapshot_id)
        self._record_slot(slot_day, True, len(frame))
        self._update_health(collected_at, len(frame))
        self.consecutive_failures = 0
        self.failure_alert_sent = False
        logging.info(
            "수집 성공 snapshot_id=%s collected_at=%s stations=%d",
            snapshot_id,
            collected_at.isoformat(),
            len(frame),
        )

    def run_once(self) -> None:
        """Collect, publish, and persist exactly one complete snapshot."""
        now = datetime.now(KST)
        self._send_due_summary(now)
        frame = self.fetch_snapshot()
        self._store_successful_snapshot(frame, now.date())
        self.flush()

    def run(self) -> None:
        self.notify_discord(f"🚲 타슈 수집기 시작: {datetime.now(KST).isoformat()}")
        self._replay_kafka()
        while not self.stop_requested:
            self._sleep_until_next_slot()
            if self.stop_requested:
                break
            slot_day = datetime.now(KST).date()
            self._send_due_summary(datetime.now(KST))
            try:
                frame = self.fetch_snapshot()
            except ApiError as exc:
                self._record_slot(slot_day, False)
                self.consecutive_failures += 1
                logging.error("슬롯 수집 실패 consecutive=%d: %s", self.consecutive_failures, exc)
                if self.consecutive_failures >= 5 and not self.failure_alert_sent:
                    self.notify_discord(
                        f"⚠️ 타슈 수집 연속 {self.consecutive_failures}회 실패 "
                        f"({datetime.now(KST).isoformat()}): {exc}"
                    )
                    self.failure_alert_sent = True
            else:
                self._store_successful_snapshot(frame, slot_day)
            if time.monotonic() - self.last_flush >= FLUSH_SECONDS:
                self.flush()

    def close(self, normal: bool) -> None:
        try:
            self.flush()
        finally:
            self.session.close()
            if self.kafka_outbox is not None:
                self.kafka_outbox.close()
            if self.redis_publisher is not None:
                self.redis_publisher.close()
            if normal:
                self.notify_discord(f"🛑 타슈 수집기 정상 종료: {datetime.now(KST).isoformat()}")


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(KstFormatter("%(asctime)s %(levelname)s %(message)s"))
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        handlers=[handler],
        force=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect Tashu station snapshots")
    parser.add_argument(
        "--once",
        action="store_true",
        help="collect, publish, and persist exactly one snapshot, then exit",
    )
    args = parser.parse_args()
    configure_logging()
    try:
        collector = Collector()
    except Exception:
        logging.exception("수집기 초기화 실패")
        return 1
    signal.signal(signal.SIGTERM, collector.request_stop)
    signal.signal(signal.SIGINT, collector.request_stop)
    normal = False
    try:
        if args.once:
            collector.run_once()
        else:
            collector.run()
        normal = True
        return 0
    except Exception:
        logging.exception("수집기 치명적 오류")
        return 1
    finally:
        collector.close(normal)


if __name__ == "__main__":
    raise SystemExit(main())
