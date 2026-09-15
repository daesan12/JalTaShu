# -*- coding: utf-8 -*-
"""5단계 train 골격 테스트 — 데이터 무관 부분(지표·베이스라인·분할 경계·스모크)만.

본 학습·베이스라인 비교표(완료 기준)는 재생성 train_buckets 수령 후 python -m src.train 실행.
"""
import io
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_poisson_deviance

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src.train import (
    baseline_profile,
    baseline_shape_size,
    feature_matrix,
    fit_lgbm,
    metrics,
    split_sets,
)


def kst(s):
    return pd.Timestamp(s, tz=config.TZ)


def synth_frame(n=600, seed=0):
    """FEATURE_COLUMNS 전부 갖춘 합성 버킷 테이블 (2025-10 core / 2025-11 es / 2026-01 valid)."""
    rng = np.random.default_rng(seed)
    month = np.repeat(["2025-10-01", "2025-11-01", "2026-01-01"], n // 3)
    times = pd.to_datetime(month).tz_localize(config.TZ) + pd.to_timedelta(
        rng.integers(0, 27 * 96, n) * 15, unit="m"
    )
    slot = (times.hour * 4 + times.minute // 15).astype("int16")
    lam_true = 0.5 + 2.0 * (slot.to_numpy() > 32)
    df = pd.DataFrame(
        {
            "station_id": pd.Categorical(rng.choice(["ST0001", "ST0002", "ST0003"], n)),
            "bucket_start": times,
            "rentals": rng.poisson(lam_true).astype("int16"),
            "returns": rng.poisson(1.0, n).astype("int16"),
            "slot_of_day": slot,
            "weekday": times.weekday.astype("int8"),
            "holiday_type": pd.Categorical(["none"] * n, categories=list(config.HOLIDAY_TYPES)),
            "temperature": rng.normal(15, 5, n).astype("float32"),
            "rainfall_1h": np.zeros(n, dtype="float32"),
            "minutes_since_rain": np.full(n, 1440, dtype="float32"),
            "profile_rentals": (0.5 + 2.0 * (slot.to_numpy() > 32)).astype("float32"),
            "profile_returns": np.full(n, 1.0, dtype="float32"),
            "delta_30m": rng.normal(0, 2, n).astype("float32"),
            "delta_60m": rng.normal(0, 3, n).astype("float32"),
        }
    )
    return df


def test_split_boundaries_no_random():
    df = synth_frame()
    core, es, valid = split_sets(df, io.StringIO())
    assert (core["bucket_start"] < kst(config.EARLY_STOP_START)).all()
    assert (es["bucket_start"] >= kst(config.EARLY_STOP_START)).all()
    assert (es["bucket_start"] < kst(config.SPLIT_DATE)).all()
    assert (valid["bucket_start"] >= kst(config.SPLIT_DATE)).all()
    assert len(core) + len(es) + len(valid) == len(df)


def test_metrics_match_sklearn_and_handle_zero_pred():
    y = pd.Series([0, 1, 3, 2])
    pred = pd.Series([0.5, 1.2, 2.5, 0.0])  # 0 예측은 클립 후 계산돼야 함
    dev, mae = metrics(y, pred)
    clipped = np.clip(pred, 1e-6, None)
    assert dev == float(mean_poisson_deviance(y, clipped))
    assert mae == float(np.abs(y - pred).mean())


def test_baseline_profile_uses_profile_and_falls_back():
    train = pd.DataFrame(
        {"weekday": [2, 2], "slot_of_day": [33, 33], "rentals": [4, 2],
         "profile_rentals": [3.0, 3.0]}
    )
    valid = pd.DataFrame(
        {"weekday": [2, 2], "slot_of_day": [33, 33],
         "profile_rentals": [3.0, np.nan]}  # 두 번째 행 = 신규 대여소
    )
    pred = baseline_profile(train, valid, "rentals")
    assert pred.tolist() == [3.0, 3.0]  # 신규는 (weekday,slot) 셀 평균 (4+2)/2 로 폴백


def test_baseline_shape_size_math():
    # 학습: ST0001 평균 2.0, ST0002 평균 4.0 / 셀(2,33) 평균 3.0 = 전체 평균 → shape 비 1.0
    train = pd.DataFrame(
        {"station_id": pd.Categorical(["ST0001", "ST0001", "ST0002", "ST0002"]),
         "weekday": [2, 2, 2, 2], "slot_of_day": [33, 33, 33, 33],
         "rentals": [2, 2, 4, 4]}
    )
    valid = pd.DataFrame(
        {"station_id": pd.Categorical(["ST0001", "ST0002", "ST9999"]),
         "weekday": [2, 2, 2], "slot_of_day": [33, 33, 33]}
    )
    pred = baseline_shape_size(train, valid, "rentals")
    assert pred.tolist() == [2.0, 4.0, 3.0]  # 미학습 대여소 = 전체 평균 크기로 폴백


def test_fit_lgbm_smoke_poisson_nonnegative():
    """소형 합성 데이터 스모크: poisson objective로 학습·예측이 유한 음수 없음."""
    df = synth_frame(n=900, seed=1)
    core, es, valid = split_sets(df, io.StringIO())
    model = fit_lgbm(core, es, "rentals", io.StringIO())
    pred = model.predict(feature_matrix(valid))
    assert np.isfinite(pred).all() and (pred >= 0).all()
    assert model.best_iteration_ >= 1


def test_feature_matrix_order_is_contractual():
    """serve.py가 같은 순서로 행을 만들므로 컬럼 순서는 config에 고정돼 있어야 한다."""
    df = synth_frame(n=30)
    assert list(feature_matrix(df).columns) == list(config.FEATURE_COLUMNS)


def test_load_columns_no_duplicates():
    """station_id가 키이자 피처 — 적재 컬럼 목록이 중복되면 read_parquet이 중복 컬럼을 만든다."""
    from src.train import LOAD_COLUMNS
    assert len(LOAD_COLUMNS) == len(set(LOAD_COLUMNS))
    assert set(config.FEATURE_COLUMNS) <= set(LOAD_COLUMNS)