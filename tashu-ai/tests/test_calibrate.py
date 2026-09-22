# -*- coding: utf-8 -*-
"""9단계 calibrate 테스트 — 지표 표(모델·베이스라인·콜드스타트 분리) · 캘리브레이션 곡선 · 보정계수 탐색.

합성 리플레이 테이블: 실제 고갈을 알려진 확률(모델 예측의 1.2배)로 뽑아 낙관 편향을 심어두고,
보정계수 탐색이 1.0보다 큰 값을 고르는지, 곡선의 observed/pred가 1을 넘는지 확인한다.
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src import calibrate, probability


def synthetic_table(n_stations=300, n_times=40, bias=1.2, seed=0):
    rng = np.random.default_rng(seed)
    rows = []
    t0 = pd.Timestamp("2026-09-11 08:00", tz=config.TZ)
    for k in range(n_times):
        t = t0 + pd.Timedelta(minutes=5 * k)
        s = rng.integers(0, 6, size=n_stations).astype(float)
        for h in config.EVAL_HORIZONS_MIN:
            lam = rng.gamma(2.0, 0.4, size=n_stations) * h / 15
            mu = rng.gamma(2.0, 0.2, size=n_stations) * h / 15
            p = probability.depletion_probability(s, lam, mu)
            depleted = (rng.random(n_stations) < np.clip(p * bias, 0, 1)).astype(float)
            has_profile = np.arange(n_stations) % 10 != 0
            rows.append(pd.DataFrame({
                "t": t, "station_id": [f"ST{i:04d}" for i in range(n_stations)], "horizon_min": h,
                "s": s, "lam_total": lam, "mu_total": mu, "prob_model": p,
                "bikes_pred": np.clip(s + mu - lam, 0, None),
                "prob_bl_profile": np.where(has_profile, np.clip(p * rng.uniform(0.5, 1.5, n_stations), 0, 1), np.nan),
                "prob_bl_current": (s <= 0).astype(float),
                "has_profile": has_profile, "has_delta": True,
                "bikes_actual": np.where(depleted == 1, 0.0, np.maximum(s, 1.0)), "depleted": depleted,
            }))
    return pd.concat(rows, ignore_index=True)


def test_metrics_table_shape_and_groups():
    table = synthetic_table()
    m = calibrate.metrics_table(table)
    assert set(m["group"]) == {"all", "has_profile", "new_station", "has_bike_now", "empty_now"}
    hb = m[(m["group"] == "has_bike_now") & (m["predictor"] == "model")]
    assert (hb["n"] == (table["s"] >= 1).groupby(table["horizon_min"]).sum().to_numpy()).all()
    assert set(m["predictor"]) == {"model", "bl_profile", "bl_current"}
    assert set(m["horizon_min"]) == set(config.EVAL_HORIZONS_MIN)
    allm = m[(m["group"] == "all") & (m["predictor"] == "model")]
    assert allm["brier"].between(0, 1).all() and allm["pr_auc"].between(0, 1).all()
    # 신규 대여소 그룹은 프로파일 베이스라인이 전부 NaN
    new_bl = m[(m["group"] == "new_station") & (m["predictor"] == "bl_profile")]
    assert new_bl["brier"].isna().all()


def test_model_beats_current_bikes_heuristic():
    """현재 잔여 휴리스틱(s≤0→1, 아니면 0)은 s>0에서 일어나는 고갈을 전부 놓친다 → 모델 Brier가 더 낮아야 함."""
    m = calibrate.metrics_table(synthetic_table())
    allm = m[m["group"] == "all"].pivot(index="horizon_min", columns="predictor", values="brier")
    assert (allm["model"] < allm["bl_current"]).all()


def test_calibration_curve_detects_optimistic_bias():
    curve = calibrate.calibration_curve(synthetic_table(bias=1.3), bins=5)
    mid = curve[(curve["horizon_min"] == 15) & (curve["n"] >= 50) & (curve["mean_pred"].between(0.1, 0.8))]
    assert not mid.empty
    assert mid["observed_over_pred"].median() > 1.0  # 실제가 예측보다 자주 고갈 → 낙관 편향


def test_tail_correction_search_prefers_above_one_when_biased():
    tail = calibrate.tail_correction_search(synthetic_table(bias=1.3))
    best = tail[tail["best"]].groupby("horizon_min")["tail_correction"].first()
    assert (best > 1.0).all()
    assert set(tail["tail_correction"]) == set(config.TAIL_CORRECTION_GRID)
    assert (tail.groupby("horizon_min")["best"].sum() >= 1).all()


def test_tail_correction_search_near_one_when_unbiased():
    tail = calibrate.tail_correction_search(synthetic_table(bias=1.0, n_stations=600))
    best = tail[tail["best"]].groupby("horizon_min")["tail_correction"].first()
    assert (best <= 1.1).all()


def test_isotonic_monotone_and_bounded():
    iso = calibrate.fit_isotonic(synthetic_table(), 15)
    grid = np.linspace(0, 1, 21)
    out = iso.predict(grid)
    assert (np.diff(out) >= -1e-12).all() and out.min() >= 0 and out.max() <= 1


def test_report_writes_all_sections(tmp_path):
    import io
    table = synthetic_table(n_stations=100, n_times=10)
    log = io.StringIO()
    calibrate.write_report(table, calibrate.metrics_table(table), calibrate.calibration_curve(table),
                           calibrate.tail_correction_search(table), log)
    text = log.getvalue()
    for key in ("기간", "[지표", "[콜드스타트 분리]", "[캘리브레이션 곡선", "[보정계수 탐색]"):
        assert key in text
