"""Publish the latest complete station snapshot to Redis atomically."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime

import pandas as pd
import redis


DEFAULT_KEY = "tashu:station-availability:latest:v1"
REQUIRED_COLUMNS = ("station_id", "bikes", "collected_at")


class RedisPublishError(RuntimeError):
    """Raised when the latest snapshot cannot be written to Redis."""


def _positive_int(name: str, default: int) -> int:
    raw = os.environ.get(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be greater than zero")
    return value


@dataclass(frozen=True)
class RedisSnapshotPublisher:
    """Use one SET so readers never observe a partially updated snapshot."""

    client: redis.Redis
    key: str
    ttl_seconds: int

    @classmethod
    def from_env(cls) -> "RedisSnapshotPublisher":
        host = os.environ.get("TASHU_REDIS_HOST", "localhost").strip() or "localhost"
        port = _positive_int("TASHU_REDIS_PORT", 6379)
        try:
            database = int(os.environ.get("TASHU_REDIS_DATABASE", "0").strip())
        except ValueError as exc:
            raise RuntimeError("TASHU_REDIS_DATABASE must be an integer") from exc
        if database < 0:
            raise RuntimeError("TASHU_REDIS_DATABASE must be zero or greater")
        password = os.environ.get("TASHU_REDIS_PASSWORD", "").strip() or None
        key = os.environ.get("TASHU_REDIS_LATEST_KEY", DEFAULT_KEY).strip()
        if not key:
            raise RuntimeError("TASHU_REDIS_LATEST_KEY must not be empty")
        ttl_seconds = _positive_int("TASHU_REDIS_TTL_SECONDS", 180)
        client = redis.Redis(
            host=host,
            port=port,
            db=database,
            password=password,
            socket_connect_timeout=2,
            socket_timeout=2,
            decode_responses=True,
        )
        return cls(client=client, key=key, ttl_seconds=ttl_seconds)

    def publish(self, frame: pd.DataFrame, snapshot_id: str) -> None:
        missing = [name for name in REQUIRED_COLUMNS if name not in frame.columns]
        if missing:
            raise RedisPublishError(f"snapshot columns missing: {', '.join(missing)}")
        if frame.empty:
            raise RedisPublishError("empty snapshots are not publishable")

        stations: list[dict[str, str | int]] = []
        station_ids: set[str] = set()
        collected_at_values: set[str] = set()
        for row in frame.loc[:, REQUIRED_COLUMNS].itertuples(index=False):
            station_id = str(row.station_id).strip()
            if not station_id:
                raise RedisPublishError("station_id must not be empty")
            if station_id in station_ids:
                raise RedisPublishError(f"duplicate station_id: {station_id}")

            collected_at = row.collected_at
            if hasattr(collected_at, "to_pydatetime"):
                collected_at = collected_at.to_pydatetime()
            if not isinstance(collected_at, datetime) or collected_at.tzinfo is None:
                raise RedisPublishError("collected_at must be a timezone-aware datetime")

            try:
                bikes = int(row.bikes)
            except (TypeError, ValueError) as exc:
                raise RedisPublishError(f"invalid bikes: station_id={station_id}") from exc
            if bikes < 0:
                raise RedisPublishError(f"bikes must be zero or greater: station_id={station_id}")

            collected_at_iso = collected_at.isoformat()
            station_ids.add(station_id)
            collected_at_values.add(collected_at_iso)
            stations.append(
                {
                    "station_id": station_id,
                    "bikes": bikes,
                    "collected_at": collected_at_iso,
                }
            )

        if len(collected_at_values) != 1:
            raise RedisPublishError("all stations must share one collected_at value")

        payload = json.dumps(
            {
                "schema_version": 1,
                "snapshot_id": snapshot_id,
                "station_count": len(stations),
                "stations": stations,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )
        try:
            stored = self.client.set(self.key, payload, ex=self.ttl_seconds)
        except redis.RedisError as exc:
            raise RedisPublishError("Redis snapshot publish failed") from exc
        if not stored:
            raise RedisPublishError("Redis snapshot publish failed")

    def close(self) -> None:
        self.client.close()
