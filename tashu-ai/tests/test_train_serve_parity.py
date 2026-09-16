# -*- coding: utf-8 -*-
"""8단계 검수 3 (계약 검수 체크 3): 같은 시각의 학습 피처 행 vs 서빙 피처 행 컬럼별 일치.

학습 행 = Spark train_buckets (데이터 담당 산출), 서빙 행 = serve.build_feature_rows (같은 시각 now).
비교 컬럼 = FEATURE_COLUMNS 중 소스가 같은 것: slot_of_day · weekday · holiday_type ·
temperature · rainfall_1h · minutes_since_rain · profile_rentals · profile_returns.
- 날씨: Spark 값은 발표 지연 정렬(H:40)이 적용된 값이라 원 관측이 없다 → H:45 버킷 값 = obs(H)로
  정시 관측을 역구성해 서빙 입력으로 넣고, 4개 버킷 전부 같은 값이 나오는지 본다 (정렬 규칙 동일성 검증).
- delta: 학습(이벤트 합)과 서빙(스냅샷 차)은 소스가 달라 값 비교 대상이 아님 — 정의 동일성은 test_delta.
- station_id: 서빙에서 category dtype으로 넘기며 LightGBM이 학습 카테고리로 재매핑 (test_serve).
Spark 파일이 없으면 skip (DATA_ROOT/spark/train_buckets/YYYY-MM.parquet).
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src import serve

SPARK = config.SPARK_DIR / "train_buckets"
COMPARE_COLS = ["slot_of_day", "weekday", "holiday_type", "temperature", "rainfall_1h",
                "minutes_since_rain", "profile_rentals", "profile_returns"]

needs_data = pytest.mark.skipif(
    not (SPARK / "2026-01.parquet").exists() or not config.PROFILE_PATH.exists(),
    reason="Spark train_buckets 또는 station_profile 없음",
)


def kst(s):
    return pd.Timestamp(s, tz=config.TZ)


@pytest.fixture(scope="module")
def profile():
    p = pd.read_parquet(config.PROFILE_PATH)
    p["station_id"] = p["station_id"].astype(str)
    return p


_month_cache = {}


def load_month(month: str) -> pd.DataFrame:
    if month not in _month_cache:
        df = pd.read_parquet(SPARK / f"{month}.parquet",
                             columns=["station_id", "bucket_start", *COMPARE_COLS])
        df["bucket_start"] = df["bucket_start"].dt.tz_convert(config.TZ)  # 저장은 UTC (계약 §1)
        df["station_id"] = df["station_id"].astype(str)
        _month_cache[month] = df
    return _month_cache[month]


def reconstruct_hourly_obs(df: pd.DataFrame) -> pd.DataFrame:
    """H:45 버킷의 available 값 = obs(H) (t ≥ H:40) → 정시 관측 테이블 복원."""
    per_bucket = df.groupby("bucket_start")[["temperature", "rainfall_1h"]].first()
    at45 = per_bucket[per_bucket.index.minute == 45]
    return pd.DataFrame({
        "obs_time": at45.index.floor("h"),
        "temperature": at45["temperature"].to_numpy(),
        "rainfall_1h": at45["rainfall_1h"].to_numpy(),
    })


def serving_rows_at(now: pd.Timestamp, month_df: pd.DataFrame, profile: pd.DataFrame) -> pd.DataFrame:
    b0 = now.floor(f"{config.BUCKET_MINUTES}min")
    stations = sorted(month_df.loc[month_df["bucket_start"] == b0, "station_id"].unique())
    assert stations, f"{b0} 에 학습 행 없음"
    times = pd.date_range(now - pd.Timedelta(minutes=70), now - pd.Timedelta(seconds=30), freq="45s")
    snapshots = pd.DataFrame({
        "station_id": np.repeat(stations, len(times)),
        "snapshot_time": pd.DatetimeIndex(np.tile(times, len(stations))).tz_convert(config.TZ),
        "bikes": 5,
    })
    obs = reconstruct_hourly_obs(month_df[month_df["bucket_start"] < now])  # now 이전 관측만 (누출 금지)
    rows = serve.build_feature_rows(now, snapshots, profile, obs)
    rows["station_id"] = rows["station_id"].astype(str)
    rows["holiday_type"] = rows["holiday_type"].astype(str)
    return rows


def assert_columns_match(serving: pd.DataFrame, training: pd.DataFrame) -> None:
    merged = serving.merge(training, on=["station_id", "bucket_start"], suffixes=("_serve", "_train"))
    assert len(merged) == len(serving), "학습 표에 없는 (station, bucket) 행이 서빙에 있음"
    for col in COMPARE_COLS:
        a, b = merged[f"{col}_serve"], merged[f"{col}_train"]
        if col == "holiday_type":
            bad = a != b.astype(str)
        else:
            a, b = a.astype("float64"), b.astype("float64")
            bad = ~(np.isclose(a, b, atol=1e-6, equal_nan=True))
        assert not bad.any(), (
            f"{col} 불일치 {int(bad.sum())}/{len(merged)}행 — 예: "
            f"{merged.loc[bad, ['station_id', 'bucket_start', f'{col}_serve', f'{col}_train']].head(3).to_dict('records')}"
        )


@needs_data
def test_feature_column_order_matches_config(profile):
    """서빙 행의 피처 컬럼이 FEATURE_COLUMNS와 같은 이름·순서로 존재 (train.feature_matrix가 쓰는 순서)."""
    rows = serving_rows_at(kst("2026-01-14 10:10"), load_month("2026-01"), profile)
    assert list(rows.columns[:2]) == ["station_id", "bucket_start"]
    assert list(rows.columns[2:2 + len(config.FEATURE_COLUMNS) - 1]) == list(config.FEATURE_COLUMNS[1:])


@needs_data
@pytest.mark.parametrize("month, now_str", [
    ("2026-01", "2026-01-14 10:10"),  # 평일, 정시 전(10:10 < 10:40 → 09:00 관측)
    ("2026-01", "2026-01-14 10:50"),  # 정시 후(10:50 ≥ 10:40 → 10:00 관측), 다음 버킷 11:00도 10:00 관측
    ("2026-02", "2026-02-17 08:10"),  # 설날(major)
    ("2026-03", "2026-03-02 10:10"),  # 삼일절 대체공휴일(substitute)
    # 월 초(예: 01-01 00:10)는 월 파일만으로 24시간 관측 이력을 복원할 수 없어 제외 (서빙은 DB 24h+ 이력 필수)
])
def test_static_and_weather_features_match_spark(profile, month, now_str):
    now = kst(now_str)
    month_df = load_month(month)
    serving = serving_rows_at(now, month_df, profile)
    training = month_df[month_df["bucket_start"].isin(serving["bucket_start"].unique())]
    assert_columns_match(serving, training)


@needs_data
def test_minutes_since_rain_after_rain_matches_spark(profile):
    """강수 후 경과분: 1월 첫 강수(≥1mm/h) 5시간 뒤 시점에서 Spark와 같은 값."""
    month_df = load_month("2026-01")
    obs = reconstruct_hourly_obs(month_df)
    rainy = obs.loc[(obs["rainfall_1h"] >= config.RAIN_THRESHOLD_MMH) & (obs["obs_time"] >= kst("2026-01-03")), "obs_time"]
    assert not rainy.empty, "1월에 강수 시각 없음"
    now = rainy.iloc[0] + pd.Timedelta(hours=5, minutes=10)
    serving = serving_rows_at(now, month_df, profile)
    training = month_df[month_df["bucket_start"].isin(serving["bucket_start"].unique())]
    assert_columns_match(serving, training)
    assert 0 < serving["minutes_since_rain"].iloc[0] < config.MINUTES_SINCE_RAIN_CAP


@needs_data
def test_new_station_profile_nan_both_sides(profile):
    """학습 구간에 없던 대여소: 양쪽 모두 profile NaN (계약 §5)."""
    month_df = load_month("2026-01")
    now = kst("2026-01-14 10:10")
    serving = serving_rows_at(now, month_df, profile)
    training = month_df[month_df["bucket_start"] == now.floor("15min")]
    new_train = set(training.loc[training["profile_rentals"].isna(), "station_id"])
    new_serve = set(serving.loc[serving["profile_rentals"].isna(), "station_id"])
    assert new_train == new_serve
