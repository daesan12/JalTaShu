# -*- coding: utf-8 -*-
"""4단계 delta 테스트 — 수동 대조·NaN 규칙(|delta|>20, 60분 미만)·서빙 스냅샷 재현.

완료 기준(가이드 표 4): 임의 대여소 delta_30m 수동 대조 + NaN 규칙 테스트.
실데이터 검수는 Spark train_buckets의 delta 컬럼과 전량 대조(통합 테스트)로 수행.
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src.features import add_train_delta, snapshot_delta


def kst(s):
    return pd.Timestamp(s, tz=config.TZ)


def bucket_series(station_id, start, rentals, returns):
    n = len(rentals)
    times = pd.date_range(kst(start), periods=n, freq=f"{config.BUCKET_MINUTES}min")
    return pd.DataFrame(
        {"station_id": station_id, "bucket_start": times, "rentals": rentals, "returns": returns}
    )


# ── 학습 delta: 수동 대조 (검수 2 방식) ─────────────────────────────────

def test_train_delta_manual_check():
    """net = returns−rentals = [-1,-1,-2,-2,-3] → 09:00의 delta_30m = -4, delta_60m = -6 (수동 계산)."""
    df = bucket_series("ST0001", "2024-06-05 08:00", rentals=[1, 2, 3, 4, 5], returns=[0, 1, 1, 2, 2])
    out = add_train_delta(df)
    row = out[out["bucket_start"] == kst("2024-06-05 09:00")].iloc[0]
    assert row["delta_30m"] == -4.0  # 08:30·08:45 버킷 합, 자기 버킷(09:00) 미포함
    assert row["delta_60m"] == -6.0  # 08:00~08:45 4개 버킷 합
    # 08:45 시점: delta_30m = net(08:15)+net(08:30) = -3
    assert out[out["bucket_start"] == kst("2024-06-05 08:45")].iloc[0]["delta_30m"] == -3.0


def test_train_delta_insufficient_history_is_nan():
    """60분(delta_60m 기준) 미만 이력 → NaN. 첫 행은 30m도 NaN."""
    df = bucket_series("ST0001", "2024-06-05 08:00", rentals=[1] * 5, returns=[2] * 5)
    out = add_train_delta(df)
    assert out["delta_30m"].isna().tolist() == [True, True, False, False, False]
    assert out["delta_60m"].isna().tolist() == [True, True, True, True, False]


def test_train_delta_gap_resets_history():
    """마스크·운영 공백 등으로 버킷이 끊기면 공백 이후 이력은 처음부터 다시 쌓인다."""
    a = bucket_series("ST0001", "2024-06-05 08:00", rentals=[1, 1], returns=[0, 0])
    b = bucket_series("ST0001", "2024-06-05 10:00", rentals=[1, 1, 1], returns=[0, 0, 0])
    out = add_train_delta(pd.concat([a, b], ignore_index=True))
    # 10:00·10:15는 공백 직후 이력 부족 → NaN, 10:30에야 delta_30m 계산
    assert out["delta_30m"].isna().tolist() == [True, True, True, True, False]
    assert out[out["bucket_start"] == kst("2024-06-05 10:30")].iloc[0]["delta_30m"] == -2.0


def test_train_delta_rebalance_threshold():
    """|delta| > 20 → NaN (재배치). 경계값 ±20은 유지."""
    df = bucket_series("ST0001", "2024-06-05 08:00", rentals=[0, 0, 0, 0], returns=[10, 10, 11, 0])
    out = add_train_delta(df)
    assert out.iloc[2]["delta_30m"] == 20.0   # 10+10 = 20 → 유지
    assert np.isnan(out.iloc[3]["delta_30m"])  # 10+11 = 21 → NaN


def test_train_delta_stations_isolated():
    """대여소가 다르면 시계열이 섞이면 안 된다."""
    a = bucket_series("ST0001", "2024-06-05 08:00", rentals=[0, 0, 0], returns=[1, 1, 1])
    b = bucket_series("ST0002", "2024-06-05 08:30", rentals=[5, 5, 5], returns=[0, 0, 0])
    out = add_train_delta(pd.concat([a, b], ignore_index=True))
    st2 = out[out["station_id"] == "ST0002"]
    assert st2["delta_30m"].isna().tolist() == [True, True, False]
    assert st2.iloc[2]["delta_30m"] == -10.0


# ── 서빙 delta: 스냅샷 재현 (계약 §8) ───────────────────────────────────

def snap_frame(rows):
    return pd.DataFrame(
        {"station_id": [r[0] for r in rows],
         "snapshot_time": [kst(r[1]) for r in rows],
         "bikes": [r[2] for r in rows]}
    )


def base_snapshots():
    """07:00부터 45초 간격 폴링을 흉내낸 10:00까지의 스냅샷.

    bikes는 15분(20폴링)마다 +1 — delta_30m=2, delta_60m=4로 |delta|>20 임계값 안쪽.
    """
    times = pd.date_range(kst("2024-06-05 07:00"), kst("2024-06-05 10:00"), freq="45s")
    return pd.DataFrame({"station_id": "ST0001", "snapshot_time": times,
                         "bikes": [10 + i // 20 for i in range(len(times))]})


def test_snapshot_delta_basic():
    snaps = snap_frame(
        [("ST0001", "2024-06-05 07:00", 5),   # 기동
         ("ST0001", "2024-06-05 09:29", 6),   # t−30m(09:30) 직전
         ("ST0001", "2024-06-05 08:59", 8),   # t−60m(09:00) 직전
         ("ST0001", "2024-06-05 09:59", 10)]  # t 직전
    )
    out = snapshot_delta(kst("2024-06-05 10:00"), snaps)
    assert out.iloc[0]["delta_30m"] == 4.0   # 10 − 6
    assert out.iloc[0]["delta_60m"] == 2.0   # 10 − 8


def test_snapshot_delta_tolerance_3min():
    """기준 시각 ±3분(과거 방향) 내 스냅샷이 없으면 NaN."""
    snaps = snap_frame(
        [("ST0001", "2024-06-05 07:00", 5),
         ("ST0001", "2024-06-05 09:26", 6),   # t−30m(09:30)에서 4분 전 — 허용 초과
         ("ST0001", "2024-06-05 09:59", 10)]
    )
    out = snapshot_delta(kst("2024-06-05 10:00"), snaps)
    assert np.isnan(out.iloc[0]["delta_30m"])


def test_snapshot_delta_never_uses_future():
    """기준 시각 이후의 스냅샷은 1초 뒤라도 쓰지 않는다 (백테스트 리플레이 누출 방지)."""
    snaps = snap_frame(
        [("ST0001", "2024-06-05 07:00", 5),
         ("ST0001", "2024-06-05 09:30:01", 99),  # t−30m 직후 — 사용 금지
         ("ST0001", "2024-06-05 09:59", 10)]
    )
    out = snapshot_delta(kst("2024-06-05 10:00"), snaps)
    assert np.isnan(out.iloc[0]["delta_30m"])


def test_snapshot_delta_warmup_60min():
    """수집기 기동 후 60분 미만이면 스냅샷이 있어도 전부 NaN."""
    snaps = base_snapshots()
    early = snapshot_delta(kst("2024-06-05 07:59"), snaps)
    assert early.filter(like="delta_").isna().all().all()
    ready = snapshot_delta(kst("2024-06-05 08:00"), snaps)
    assert ready.filter(like="delta_").notna().all().all()


def test_snapshot_delta_rebalance_threshold():
    snaps = snap_frame(
        [("ST0001", "2024-06-05 07:00", 5),
         ("ST0001", "2024-06-05 09:29", 0),
         ("ST0001", "2024-06-05 09:59", 21)]  # delta_30m = 21 → NaN
    )
    out = snapshot_delta(kst("2024-06-05 10:00"), snaps)
    assert np.isnan(out.iloc[0]["delta_30m"])


def test_snapshot_delta_45s_polling_realistic():
    """45초 폴링 이력에서 각 기준 시각의 '직전' 스냅샷이 골라지는지."""
    snaps = base_snapshots()  # bikes가 15분마다 +1
    out = snapshot_delta(kst("2024-06-05 09:00"), snaps)
    assert out.iloc[0]["delta_30m"] == 2.0
    assert out.iloc[0]["delta_60m"] == 4.0


# ── 통합: Spark train_buckets의 delta 컬럼과 전량 대조 (검수 2 확장) ─────

SPARK_FILE = config.SPARK_DIR / "train_buckets" / "2024-06.parquet"
OUR_FILE = config.ARTIFACTS_DIR / "buckets" / "buckets_2024-06.parquet"
needs_data = pytest.mark.skipif(
    not (SPARK_FILE.exists() and OUR_FILE.exists()),
    reason="Spark train_buckets 또는 2단계 산출물 없음",
)


@needs_data
def test_train_delta_matches_spark_table():
    """우리 add_train_delta ↔ Spark delta 컬럼: 정의된 셀 전량 값 일치 (2024-06)."""
    ours = pd.read_parquet(OUR_FILE)
    ours["station_id"] = ours["station_id"].astype(str)
    ours = add_train_delta(ours)
    spark = pd.read_parquet(SPARK_FILE, columns=["station_id", "bucket_start", "delta_30m", "delta_60m"])
    spark["bucket_start"] = spark["bucket_start"].dt.tz_convert(config.TZ)
    merged = ours.merge(spark, on=["station_id", "bucket_start"], suffixes=("_ai", "_sp"))
    assert len(merged) == len(ours)
    for col in ("delta_30m", "delta_60m"):
        ai, sp = merged[f"{col}_ai"], merged[f"{col}_sp"]
        both = ai.notna() & sp.notna()
        assert (ai[both] == sp[both]).all(), f"{col} 값 불일치 {int((ai[both] != sp[both]).sum()):,}건"
        # 우리가 정의한 셀을 Spark가 NaN 처리한 경우(또는 그 반대)도 없어야 한다
        assert int((ai.notna() != sp.notna()).sum()) == 0, f"{col} NaN 패턴 불일치"
