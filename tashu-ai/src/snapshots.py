# -*- coding: utf-8 -*-
"""S3 bronze/realtime Parquet 로더 — 캘리브레이션·백테스트 홀드아웃 입력 (9·10단계).

로컬에 `aws s3 sync`로 내려받은 폴더만 읽는다 (config.S3_LOCAL_ROOT):
  snapshots/dt=YYYY-MM-DD/snapshots-HHMMSS-<uuid>.parquet
      collected_at(Asia/Seoul), station_id, station_name, lat, lon, bikes
  weather/observations/dt=YYYY-MM-DD/weather-HHMM-nx67-ny100.parquet
      observed_at(Asia/Seoul, 발표 지연 적용된 정시), fetched_at, nx, ny, temperature, rainfall_1h, source
dt 파티션은 KST 날짜 기준 (데이터 담당 확인 2026-09-17).

S3 스냅샷에는 MySQL과 달리 snapshot_id·station_count가 없다 → 같은 collected_at의 행 수가
그 KST 날짜의 최대 행 수와 같을 때만 '완전 snapshot'으로 인정한다 (계약 조건 ④의 대응).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config

TIME_UNIT = "us"   # 서빙(pd.Timestamp.now / MySQL datetime)과 같은 단위. 리플레이 시점 격자도 이 단위로 만든다.


def _partition_dirs(root: Path, start: pd.Timestamp, end: pd.Timestamp) -> list[Path]:
    days = pd.date_range(start.tz_convert(config.TZ).normalize(), end.tz_convert(config.TZ).normalize(), freq="D")
    dirs = [root / f"dt={d:%Y-%m-%d}" for d in days]
    return [d for d in dirs if d.is_dir()]


def _read_partitions(dirs: list[Path], columns: list[str]) -> pd.DataFrame:
    frames = [pd.read_parquet(f, columns=columns) for d in dirs for f in sorted(d.glob("*.parquet"))]
    if not frames:
        return pd.DataFrame(columns=columns)
    return pd.concat(frames, ignore_index=True)


def _to_kst(series: pd.Series) -> pd.Series:
    """Asia/Seoul aware + 마이크로초(us) 단위로 통일.

    pandas 3은 문자열·now()로 만든 Timestamp가 us 단위이고 서빙(MySQL) 경로도 us인데, S3 스냅샷
    Parquet은 ns로 저장돼 있다. merge_asof는 단위가 다르면 거부하므로 로더에서 맞춘다 (값 손실 없음).
    """
    ts = pd.to_datetime(series)
    if ts.dt.tz is None:
        raise ValueError("naive datetime 금지 — S3 Parquet은 Asia/Seoul aware여야 한다")
    return ts.dt.tz_convert(config.TZ).dt.as_unit(TIME_UNIT)


def complete_snapshot_times(raw: pd.DataFrame, ratio: float = config.SNAPSHOT_COMPLETE_RATIO) -> pd.Index:
    """행 수 ≥ 그 KST 날짜 최대 행 수 × ratio 인 collected_at만 (API 페이지 누락 snapshot 제외).

    대여소 몇 곳이 일시적으로 API 응답에서 빠지는 변동(1,368~1,374)은 완전으로 본다 — MySQL의
    station_count(API totalCount)도 같은 변동을 따라가므로 조건 ④와 실질적으로 같은 판정.
    """
    counts = raw.groupby("collected_at", sort=True).size()
    day_max = counts.groupby(counts.index.tz_convert(config.TZ).normalize()).transform("max")
    return counts.index[counts.to_numpy() >= day_max.to_numpy() * ratio]


def load_snapshots(start: pd.Timestamp, end: pd.Timestamp,
                   root: Path = config.SNAPSHOT_PARQUET_DIR) -> pd.DataFrame:
    """[start, end] 구간(양끝 포함, KST aware)의 완전 snapshot → serve 형식 [station_id, snapshot_time, bikes] + lat, lon.

    리플레이 시점 t에는 t−65분 이력과 t+15분 실제가 필요하므로 호출 쪽이 start·end에 여유를 둔다.
    """
    raw = _read_partitions(_partition_dirs(root, start, end),
                           ["collected_at", "station_id", "bikes", "lat", "lon"])
    if raw.empty:
        return pd.DataFrame(columns=["station_id", "snapshot_time", "bikes", "lat", "lon"])
    raw["collected_at"] = _to_kst(raw["collected_at"])
    raw = raw[(raw["collected_at"] >= start) & (raw["collected_at"] <= end)]
    raw = raw[raw["collected_at"].isin(complete_snapshot_times(raw))]
    out = pd.DataFrame({
        "station_id": raw["station_id"].astype(str).to_numpy(),
        "snapshot_time": raw["collected_at"].to_numpy(),
        "bikes": raw["bikes"].astype("int64").to_numpy(),
        "lat": raw["lat"].astype("float64").to_numpy(),
        "lon": raw["lon"].astype("float64").to_numpy(),
    })
    out["snapshot_time"] = pd.DatetimeIndex(out["snapshot_time"]).tz_convert(config.TZ)
    return out.sort_values(["snapshot_time", "station_id"]).reset_index(drop=True)


def load_weather(start: pd.Timestamp, end: pd.Timestamp,
                 root: Path = config.WEATHER_PARQUET_DIR) -> pd.DataFrame:
    """[start, end] 정시 관측 → prepare_weather 입력 [obs_time, temperature, rainfall_1h]. 격자점 둘 이상이면 첫 값."""
    raw = _read_partitions(_partition_dirs(root, start, end), ["observed_at", "temperature", "rainfall_1h"])
    if raw.empty:
        return pd.DataFrame(columns=["obs_time", "temperature", "rainfall_1h"])
    out = pd.DataFrame({
        "obs_time": _to_kst(raw["observed_at"]).to_numpy(),
        "temperature": raw["temperature"].astype("float64").to_numpy(),
        "rainfall_1h": raw["rainfall_1h"].astype("float64").to_numpy(),
    })
    out["obs_time"] = pd.DatetimeIndex(out["obs_time"]).tz_convert(config.TZ)
    out = out[(out["obs_time"] >= start) & (out["obs_time"] <= end)]
    return out.sort_values("obs_time").drop_duplicates("obs_time", keep="first").reset_index(drop=True)


def merge_weather(primary: pd.DataFrame, backfill: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """기상청(primary) 우선, 없는 정시만 Open-Meteo(backfill)로 채움. (병합 결과, 소스별 시간 수 요약)."""
    if primary.empty and backfill.empty:
        return primary, pd.DataFrame(columns=["source", "hours", "from", "to"])
    p = primary.assign(source="kma")
    b = backfill[~backfill["obs_time"].isin(p["obs_time"])].assign(source="open-meteo")
    merged = pd.concat([p, b], ignore_index=True).sort_values("obs_time").reset_index(drop=True)
    summary = merged.groupby("source")["obs_time"].agg(hours="size", **{"from": "min", "to": "max"}).reset_index()
    return merged.drop(columns="source"), summary


def coverage(snapshots: pd.DataFrame) -> pd.DataFrame:
    """KST 날짜별 snapshot 수·대여소 수·최대 공백(분) — 연속 수집 구간 판정용 (리포트에 기간 근거로 기재)."""
    times = snapshots["snapshot_time"].drop_duplicates().sort_values()
    per_day = pd.DataFrame({"snapshot_time": times, "day": times.dt.normalize()})
    gap = per_day.groupby("day")["snapshot_time"].apply(lambda s: s.diff().max().total_seconds() / 60 if len(s) > 1 else float("nan"))
    stations = snapshots.groupby(snapshots["snapshot_time"].dt.normalize())["station_id"].nunique()
    n = per_day.groupby("day").size()
    return pd.DataFrame({"snapshots": n, "stations": stations, "max_gap_min": gap}).rename_axis("day")
