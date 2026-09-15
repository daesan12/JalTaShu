# -*- coding: utf-8 -*-
"""2단계 buckets 테스트 — 단위(순수 함수) + 계약 검수 1·4 (artifacts 필요, 통합)."""
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src.buckets import (
    bucket_floor,
    build_grid,
    in_any_interval,
    known_mask_intervals,
    month_buckets,
    station_windows,
    zero_rental_days,
)


def kst(*args):
    return pd.Timestamp(*args, tz=config.TZ)


# ── 단위 테스트 ─────────────────────────────────────────────────────────

def test_bucket_floor_half_open_boundary():
    """계약 §3: [start, end) — 경계 08:15:00.000은 다음 버킷, 직전 마이크로초는 이전 버킷."""
    ts = pd.Series([kst("2024-06-05 08:14:59.999999"), kst("2024-06-05 08:15:00")])
    out = bucket_floor(ts)
    assert out.iloc[0] == kst("2024-06-05 08:00:00")
    assert out.iloc[1] == kst("2024-06-05 08:15:00")


def test_station_windows_include_return_appearances():
    """운영 구간은 대여·반납 통틀어 — 반납으로만 등장한 날도 구간을 늘린다."""
    events = pd.DataFrame(
        {
            "ts": [kst("2024-06-05 08:00"), kst("2024-06-09 21:00")],
            "station_id": ["ST0001", "ST0001"],
        }
    )
    win = station_windows(events)
    assert win.loc[0, "first_day"] == kst("2024-06-05")
    assert win.loc[0, "last_day"] == kst("2024-06-09")


def test_zero_rental_days_finds_gap():
    ts = pd.Series([kst("2024-06-01 10:00"), kst("2024-06-03 10:00")])  # 06-02 도시 전체 0건
    zero = zero_rental_days(ts)
    assert list(zero) == [kst("2024-06-02")]


def test_month_buckets_masks_intervals():
    # 하루 전체 + 부분 하루(06-05 15:45~24:00 = 33버킷) 마스크
    intervals = [(kst("2024-06-02"), kst("2024-06-03")), (kst("2024-06-05 15:45"), kst("2024-06-06"))]
    buckets = month_buckets(pd.Period("2024-06", "M"), intervals)
    assert len(buckets) == 30 * config.SLOTS_PER_DAY - 96 - 33
    assert not in_any_interval(buckets, intervals).any()
    assert kst("2024-06-05 15:30") in buckets  # 경계 직전 버킷은 유지 (반개구간)
    assert kst("2024-06-05 15:45") not in buckets


def test_build_grid_respects_operating_window():
    """검수 1의 근거: 행수 = 운영 일수 × 96, 구간 밖 행 미생성."""
    windows = pd.DataFrame(
        {"station_id": ["ST0001"], "first_day": [kst("2024-06-10")], "last_day": [kst("2024-06-11")]}
    )
    grid = build_grid(month_buckets(pd.Period("2024-06", "M"), []), windows)
    assert len(grid) == 2 * config.SLOTS_PER_DAY
    assert grid["bucket_start"].min() == kst("2024-06-10 00:00")
    assert grid["bucket_start"].max() == kst("2024-06-11 23:45")


def test_known_mask_intervals_precise_boundaries():
    """장애 경계는 정밀 시각 반개구간 — 02-26 오전 실데이터·03-04 오후는 살린다."""
    intervals = known_mask_intervals()
    inside = pd.Series([kst("2025-02-26 15:45"), kst("2025-03-04 10:45"), kst("2025-12-15")])
    assert in_any_interval(inside, intervals).all()
    outside = pd.Series([kst("2025-02-26 15:30"), kst("2025-03-04 11:00"), kst("2024-05-20 23:45")])
    assert not in_any_interval(outside, intervals).any()


# ── 통합 테스트: 계약 검수 1·4 (1·2단계 산출물 필요) ─────────────────────

BUCKETS_DIR = config.ARTIFACTS_DIR / "buckets"
needs_artifacts = pytest.mark.skipif(
    not (config.TRIPS_DIR.exists() and BUCKETS_DIR.exists()),
    reason="artifacts 없음 — src.preprocess, src.buckets 먼저 실행",
)


@pytest.fixture(scope="module")
def all_events():
    files = sorted(config.TRIPS_DIR.glob("trips_*.parquet"))
    trips = pd.concat(
        [pd.read_parquet(f, columns=["rented_at", "rental_station_id", "returned_at", "return_station_id"]) for f in files],
        ignore_index=True,
    )
    rent = trips[["rented_at", "rental_station_id"]].dropna()
    rent.columns = ["ts", "station_id"]
    ret = trips[["returned_at", "return_station_id"]].dropna()
    ret.columns = ["ts", "station_id"]
    rent["station_id"] = rent["station_id"].astype(str)
    ret["station_id"] = ret["station_id"].astype(str)
    return rent, ret


def day_rows(day: pd.Timestamp) -> int:
    f = BUCKETS_DIR / f"buckets_{day:%Y-%m}.parquet"
    if not f.exists():
        return 0
    b = pd.read_parquet(f, columns=["bucket_start"])
    return int((b["bucket_start"].dt.normalize() == day).sum())


@needs_artifacts
@pytest.mark.parametrize("day_str", ["2023-05-15", "2024-06-05", "2025-09-10"])
def test_check1_rows_equal_operating_stations_x96(all_events, day_str):
    """검수 1: 임의 하루 행수 = 그날 운영 대여소 수 × 96."""
    rent, ret = all_events
    day = kst(day_str)
    windows = station_windows(pd.concat([rent, ret], ignore_index=True))
    n_operating = int(((windows["first_day"] <= day) & (windows["last_day"] >= day)).sum())
    assert day_rows(day) == n_operating * config.SLOTS_PER_DAY


def rows_in_interval(start: pd.Timestamp, end: pd.Timestamp) -> int:
    total = 0
    last = (end - pd.Timedelta(microseconds=1)).tz_localize(None).to_period("M")
    for m in pd.period_range(start.tz_localize(None).to_period("M"), last, freq="M"):
        f = BUCKETS_DIR / f"buckets_{m}.parquet"
        if not f.exists():
            continue
        b = pd.read_parquet(f, columns=["bucket_start"])["bucket_start"]
        total += int(((b >= start) & (b < end)).sum())
    return total


@needs_artifacts
def test_check4_mask_intervals_have_no_rows(all_events):
    """검수 4: 마스크 구간 행수 0 + 경계 밖 실데이터 보존 + 도시 전체 0건 날짜 ⊆ 마스크."""
    rent, _ = all_events
    for start, end in known_mask_intervals():
        n = rows_in_interval(start, end)
        assert n == 0, f"마스크 구간 [{start} ~ {end})에 행 {n:,}개 존재"
    # 정밀 경계 밖 실데이터는 살아 있어야 한다 (일 단위 과잉 마스킹 방지)
    assert rows_in_interval(kst("2025-02-26"), kst("2025-02-26 15:45")) > 0
    assert rows_in_interval(kst("2025-03-04 11:00"), kst("2025-03-05")) > 0
    # 도시 전체 0건 날짜 자동 편입 — 월 단위 샘플링 (각 월 첫 0건 날짜)
    zero = zero_rental_days(rent["ts"])
    zero_series = zero.to_series()
    sampled = zero_series.groupby(zero_series.dt.tz_localize(None).dt.to_period("M")).first()
    for day in sampled:
        assert day_rows(day) == 0, f"0건 날짜가 마스크에 미편입: {day:%Y-%m-%d}"
