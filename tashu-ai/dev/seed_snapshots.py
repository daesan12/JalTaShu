# -*- coding: utf-8 -*-
"""로컬 MySQL(dev/compose.yml)에 가짜 실시간 데이터를 채운다 — serve.py 통합 검증용.

- station_availability: station_profile의 대여소 전부 × 최근 N분 45초 폴링, 완전 snapshot.
  마지막에 '불완전 snapshot'(행 수 < station_count) 하나를 섞어 SQL 필터(조건 ④)가 걸러내는지 본다.
- weather_observation: 최근 H시간 정시 관측, 일부 시각에 비.
저장 시각은 운영과 같이 UTC. 실행: python -m dev.seed_snapshots --env-file dev/.env
"""
from __future__ import annotations

import argparse
import os
import sys
import uuid
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src import serve


def seed(conn, now: pd.Timestamp, minutes: int, weather_hours: int, incomplete: bool) -> None:
    profile = pd.read_parquet(config.PROFILE_PATH, columns=["station_id"])
    stations = sorted(profile["station_id"].astype(str).unique())
    rng = np.random.default_rng(42)

    times = pd.date_range(now - pd.Timedelta(minutes=minutes), now - pd.Timedelta(seconds=30), freq="45s")
    base = rng.integers(0, 20, size=len(stations))
    rows = []
    for t in times:
        snapshot_id = str(uuid.uuid4())
        collected = serve._utc_param(t)
        bikes = np.clip(base + rng.integers(-1, 2, size=len(stations)), 0, None)
        base = bikes
        for sid, b in zip(stations, bikes):
            rows.append((f"{snapshot_id}:{sid}", 1, snapshot_id, len(stations), collected,
                         sid, f"대여소 {sid}", 36.35, 127.38, int(b)))
    if incomplete:
        snapshot_id = str(uuid.uuid4())
        collected = serve._utc_param(now - pd.Timedelta(seconds=10))
        for sid in stations[:10]:  # station_count는 전체인데 10행만 → 불완전
            rows.append((f"{snapshot_id}:{sid}", 1, snapshot_id, len(stations), collected,
                         sid, f"대여소 {sid}", 36.35, 127.38, 99))

    with conn.cursor() as cur:
        cur.execute(f"DELETE FROM {config.SNAPSHOT_TABLE}")
        cur.execute(f"DELETE FROM {config.WEATHER_TABLE}")
        cur.executemany(
            f"INSERT INTO {config.SNAPSHOT_TABLE} (event_id, schema_version, snapshot_id, station_count, "
            f"collected_at, station_id, station_name, lat, lon, bikes) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            rows,
        )
        hours = pd.date_range(now.floor("h") - pd.Timedelta(hours=weather_hours), now.floor("h") - pd.Timedelta(hours=1), freq="h")
        weather = []
        for h in hours:
            rain = 2.5 if rng.random() < 0.15 else 0.0
            weather.append((f"kma:{h.isoformat()}", 1, serve._utc_param(h), serve._utc_param(h + pd.Timedelta(minutes=42)),
                            67, 100, float(22 + rng.normal(0, 2)), rain, "kma-ultra-srt-ncst"))
        cur.executemany(
            f"INSERT INTO {config.WEATHER_TABLE} (event_id, schema_version, observed_at, fetched_at, nx, ny, "
            f"temperature, rainfall_1h, source) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            weather,
        )
    conn.commit()
    print(f"seed: {len(stations)} stations × {len(times)} snapshots = {len(rows):,} rows"
          f"{' (+ incomplete 1)' if incomplete else ''}, weather {len(weather)} rows, now={now}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", default=None)
    parser.add_argument("--minutes", type=int, default=70)
    parser.add_argument("--weather-hours", type=int, default=26)
    parser.add_argument("--no-incomplete", action="store_true")
    parser.add_argument("--now", default=None, help="KST, 예 2026-09-16 17:10 (기본: 현재)")
    args = parser.parse_args()
    if args.env_file:
        serve.load_env_file(args.env_file)
    now = pd.Timestamp(args.now, tz=config.TZ) if args.now else pd.Timestamp.now(tz=config.TZ).floor("s")
    conn = serve.db_connect()
    seed(conn, now, args.minutes, args.weather_hours, incomplete=not args.no_incomplete)


if __name__ == "__main__":
    main()
