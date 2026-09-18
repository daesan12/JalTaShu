# -*- coding: utf-8 -*-
"""Open-Meteo 시간별 기온·강수를 받아 기상청 관측과 같은 파티션 형식으로 저장 — 날씨 공백 채우기.

학습 테이블의 과거 날씨가 Open-Meteo(계약 §6: temperature_2m °C, precipitation mm, 직전 1시간 누적,
timezone=Asia/Seoul 필수)였으므로 리플레이 구간 중 기상청 수집(2026-09-16~) 이전은 같은 소스로 채운다.
저장: config.WEATHER_BACKFILL_DIR/dt=YYYY-MM-DD/openmeteo-hourly.parquet
      (observed_at Asia/Seoul, fetched_at, nx=0, ny=0, temperature, rainfall_1h, source="open-meteo")
실행: python -m dev.fetch_openmeteo_weather --past-days 12
미래 시각(호출 시점 이후)은 저장하지 않는다 — 예보 값이 관측 자리에 들어가면 안 된다.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config

API = "https://api.open-meteo.com/v1/forecast"


def fetch_hourly(past_days: int) -> pd.DataFrame:
    params = {
        "latitude": config.OPENMETEO_LAT, "longitude": config.OPENMETEO_LON,
        "hourly": "temperature_2m,precipitation",
        "past_days": past_days, "forecast_days": 1,
        "timezone": config.TZ,  # 기본 UTC — 계약이 명시한 최다 사고 지점
    }
    with urllib.request.urlopen(f"{API}?{urllib.parse.urlencode(params)}", timeout=60) as r:
        d = json.load(r)
    h = d["hourly"]
    df = pd.DataFrame({
        "observed_at": pd.to_datetime(h["time"]).tz_localize(config.TZ),
        "temperature": pd.array(h["temperature_2m"], dtype="Float64").astype("float64"),
        "rainfall_1h": pd.array(h["precipitation"], dtype="Float64").astype("float64"),
    })
    now = pd.Timestamp.now(tz=config.TZ)
    df = df[df["observed_at"] <= now.floor("h")]  # 미래(예보) 제외
    df["fetched_at"] = now.floor("s")
    df["nx"], df["ny"], df["source"] = 0, 0, "open-meteo"
    return df.reset_index(drop=True)


def save_partitions(df: pd.DataFrame, root: Path = config.WEATHER_BACKFILL_DIR) -> int:
    n = 0
    for day, part in df.groupby(df["observed_at"].dt.normalize()):
        d = root / f"dt={day:%Y-%m-%d}"
        d.mkdir(parents=True, exist_ok=True)
        part.to_parquet(d / "openmeteo-hourly.parquet", index=False)
        n += 1
    return n


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Open-Meteo 시간별 날씨 채우기")
    parser.add_argument("--past-days", type=int, default=12, help="오늘 포함 며칠 전부터 (최대 92)")
    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    df = fetch_hourly(args.past_days)
    days = save_partitions(df)
    rainy = int((df["rainfall_1h"] >= config.RAIN_THRESHOLD_MMH).sum())
    print(f"open-meteo {len(df)}시간 ({df['observed_at'].min()} ~ {df['observed_at'].max()}), "
          f"{days}일 파티션 저장 → {config.WEATHER_BACKFILL_DIR} | 강수(≥1mm/h) {rainy}시간")


if __name__ == "__main__":
    main()
