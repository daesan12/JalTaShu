# -*- coding: utf-8 -*-
"""6단계 probability 테스트 — 지평 가중합 경계 케이스 + 포아송/Skellam 꼬리 scipy 대조.

완료 기준(가이드 표 6): 정각 출발·h=15 정확히 한 버킷 등 경계 케이스,
꼬리 확률을 scipy와 독립 계산(포아송 합성곱)으로 대조.
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from scipy.stats import poisson

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src.probability import (
    bucket_weights,
    depletion_probability,
    expected_bikes,
    horizon_total,
    predict_horizons,
    tail_correction_for,
)


def kst(s):
    return pd.Timestamp(s, tz=config.TZ)


# ── 지평 가중합 (경계 케이스 — 완료 기준) ────────────────────────────────

def test_weights_exact_one_bucket_on_boundary():
    """정각 출발 + h=15 → 정확히 한 버킷, 가중치 1.0."""
    assert bucket_weights(kst("2024-06-05 08:00"), 15) == [(kst("2024-06-05 08:00"), 1.0)]


def test_weights_split_example_from_contract():
    """계약 예시: t=08:10, h=15 → 08:00버킷×5/15 + 08:15버킷×10/15."""
    w = bucket_weights(kst("2024-06-05 08:10"), 15)
    assert w == [(kst("2024-06-05 08:00"), pytest.approx(5 / 15)),
                 (kst("2024-06-05 08:15"), pytest.approx(10 / 15))]


def test_weights_short_horizon_within_bucket():
    w = bucket_weights(kst("2024-06-05 08:10"), 5)
    assert w == [(kst("2024-06-05 08:00"), pytest.approx(5 / 15))]


def test_weights_h30_spans_three_buckets():
    w = bucket_weights(kst("2024-06-05 08:10"), 30)
    assert [x[1] for x in w] == [pytest.approx(5 / 15), pytest.approx(1.0), pytest.approx(10 / 15)]


def test_weights_seconds_precision():
    w = bucket_weights(kst("2024-06-05 08:10:30"), 15)
    assert [x[1] for x in w] == [pytest.approx(4.5 / 15), pytest.approx(10.5 / 15)]


@pytest.mark.parametrize("t,h", [("08:00", 5), ("08:07", 10), ("08:14:59", 15), ("23:50", 15)])
def test_weights_sum_equals_h_over_15(t, h):
    w = bucket_weights(kst(f"2024-06-05 {t}"), h)
    assert sum(x[1] for x in w) == pytest.approx(h / config.BUCKET_MINUTES)


def test_horizon_total_weighted_sum():
    rates = {kst("2024-06-05 08:00"): 3.0, kst("2024-06-05 08:15"): 6.0}
    got = horizon_total(kst("2024-06-05 08:10"), 15, rates)
    assert got == pytest.approx(3.0 * 5 / 15 + 6.0 * 10 / 15)  # = 5.0


def test_horizon_total_missing_bucket_raises():
    rates = {kst("2024-06-05 08:00"): 3.0}
    with pytest.raises(KeyError):
        horizon_total(kst("2024-06-05 08:10"), 15, rates)


# ── 예상 잔여 · 고갈 확률 (scipy 대조 — 완료 기준) ───────────────────────

def test_expected_bikes_formula():
    assert expected_bikes(5, 2.0, 1.0) == 4.0
    assert expected_bikes(1, 3.0, 0.5) == -1.5  # 원시값 — 클립은 serve 책임


def test_tail_matches_independent_poisson_convolution():
    """Skellam 꼬리 P(X−Y ≥ s)를 포아송 합성곱 Σ_i P(Y=i)·P(X ≥ s+i)로 독립 대조."""
    for lam, mu, s in [(3.2, 1.7, 4), (0.8, 0.3, 1), (6.0, 5.5, 3), (2.0, 2.0, 0 + 2)]:
        manual = sum(poisson.pmf(i, mu) * poisson.sf(s + i - 1, lam) for i in range(300))
        assert depletion_probability(s, lam, mu) == pytest.approx(manual, abs=1e-12)


def test_tail_reduces_to_poisson_when_mu_zero():
    """μ=0이면 포아송 꼬리 그 자체: P(X ≥ s) = poisson.sf(s−1, λ). 손계산 대조 포함."""
    assert depletion_probability(3, 2.5, 0.0) == pytest.approx(float(poisson.sf(2, 2.5)))
    assert depletion_probability(1, 1.0, 0.0) == pytest.approx(1 - np.exp(-1.0))  # P(X≥1)


def test_tail_edge_cases():
    assert depletion_probability(0, 2.0, 1.0) == 1.0    # 이미 고갈
    assert depletion_probability(-1, 2.0, 1.0) == 1.0
    assert depletion_probability(5, 0.0, 1.0) == 0.0    # 유출 없음
    assert depletion_probability(5, 0.0, 0.0) == 0.0


def test_tail_monotonicity():
    probs_by_s = [depletion_probability(s, 4.0, 1.5) for s in range(0, 8)]
    assert all(a >= b for a, b in zip(probs_by_s, probs_by_s[1:]))  # s 커질수록 감소
    probs_by_lam = [depletion_probability(3, lam, 1.5) for lam in (0.5, 1.5, 3.0, 6.0)]
    assert all(a < b for a, b in zip(probs_by_lam, probs_by_lam[1:]))  # λ 커질수록 증가


def test_tail_correction_and_clip():
    base = depletion_probability(4, 3.0, 1.0)
    assert depletion_probability(4, 3.0, 1.0, tail_correction=1.2) == pytest.approx(base * 1.2)
    assert depletion_probability(1, 20.0, 0.1, tail_correction=1.3) == 1.0  # [0,1] 클립


def test_vectorized_over_stations():
    s = np.array([0, 3, 10])
    out = depletion_probability(s, np.array([2.0, 2.0, 2.0]), np.array([1.0, 1.0, 1.0]))
    assert out.shape == (3,) and out[0] == 1.0 and out[1] > out[2]


# ── 한 대여소 지평 3개 조립 ──────────────────────────────────────────────

def test_predict_horizons_assembly():
    t = kst("2024-06-05 08:10")
    buckets = [kst("2024-06-05 08:00") + k * pd.Timedelta(minutes=15) for k in range(config.N_FEATURE_BUCKETS)]
    lam = {b: (3.0 if k == 0 else 6.0) for k, b in enumerate(buckets)}  # 60분 지평까지 버킷 율 제공
    mu = {b: 1.5 for b in buckets}
    out = predict_horizons(t, s=8, lambda_rates=lam, mu_rates=mu)
    assert set(out) == set(config.HORIZONS_MIN)
    # h=15: λ_total=5.0, μ_total=1.5 → 예상 잔여 8+1.5−5.0=4.5
    assert out[15]["bikes"] == pytest.approx(4.5)
    assert out[15]["prob_out"] == pytest.approx(float(depletion_probability(8, 5.0, 1.5, tail_correction=tail_correction_for(15))))
    # 지평이 길수록 고갈 확률 증가 (같은 율)
    assert out[5]["prob_out"] <= out[10]["prob_out"] <= out[15]["prob_out"]