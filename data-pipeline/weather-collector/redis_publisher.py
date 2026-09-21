"""Publish the latest weather observation to Redis with a bounded TTL."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import redis


DEFAULT_KEY = "tashu:weather:latest:v1"
DEFAULT_TTL_SECONDS = 3600
KST = ZoneInfo("Asia/Seoul")


class WeatherRedisPublishError(RuntimeError):
    """Raised when a weather observation cannot be written to Redis."""


def _positive_int(name: str, default: int) -> int:
    raw = os.environ.get(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be greater than zero")
    return value


def _database() -> int:
    raw = os.environ.get("WEATHER_REDIS_DATABASE", "0").strip()
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError("WEATHER_REDIS_DATABASE must be an integer") from exc
    if value < 0:
        raise RuntimeError("WEATHER_REDIS_DATABASE must be zero or greater")
    return value


def _kst_isoformat(value: Any, *, field: str) -> str:
    if not isinstance(value, datetime):
        raise WeatherRedisPublishError(f"{field} must be a datetime")
    if value.tzinfo is None:
        raise WeatherRedisPublishError(f"{field} must include a timezone")
    return value.astimezone(KST).isoformat()


def payload_for_observation(observation: Any) -> str:
    """Serialize one observation using the backend weather contract."""
    payload = {
        "schema_version": 1,
        "observed_at": _kst_isoformat(observation.observed_at, field="observed_at"),
        "fetched_at": _kst_isoformat(observation.fetched_at, field="fetched_at"),
        "nx": int(observation.nx),
        "ny": int(observation.ny),
        "temperature": float(observation.temperature),
        "rainfall_1h": float(observation.rainfall_1h),
        "source": str(observation.source),
    }
    try:
        return json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
            allow_nan=False,
        )
    except (TypeError, ValueError) as exc:
        raise WeatherRedisPublishError("invalid weather observation") from exc


@dataclass(frozen=True)
class WeatherRedisPublisher:
    client: redis.Redis
    key: str = DEFAULT_KEY
    ttl_seconds: int = DEFAULT_TTL_SECONDS

    @classmethod
    def from_env(cls) -> "WeatherRedisPublisher":
        host = os.environ.get("WEATHER_REDIS_HOST", "localhost").strip() or "localhost"
        port = _positive_int("WEATHER_REDIS_PORT", 6379)
        password = os.environ.get("WEATHER_REDIS_PASSWORD", "").strip() or None
        key = os.environ.get("WEATHER_REDIS_LATEST_KEY", DEFAULT_KEY).strip()
        if not key:
            raise RuntimeError("WEATHER_REDIS_LATEST_KEY must not be empty")
        ttl_seconds = _positive_int(
            "WEATHER_REDIS_TTL_SECONDS", DEFAULT_TTL_SECONDS
        )
        client = redis.Redis(
            host=host,
            port=port,
            db=_database(),
            password=password,
            socket_connect_timeout=2,
            socket_timeout=2,
            decode_responses=True,
        )
        return cls(client=client, key=key, ttl_seconds=ttl_seconds)

    def publish(self, observation: Any) -> None:
        payload = payload_for_observation(observation)
        try:
            stored = self.client.set(self.key, payload, ex=self.ttl_seconds)
        except redis.RedisError:
            # 연결 문자열이나 인증정보가 예외 체인을 통해 로그에 노출되지 않게 한다.
            raise WeatherRedisPublishError("weather Redis publish failed") from None
        if not stored:
            raise WeatherRedisPublishError("weather Redis publish failed")

    def close(self) -> None:
        self.client.close()
