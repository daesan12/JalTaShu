# -*- coding: utf-8 -*-
"""6단계: 확률화 층 — 지평 가중합 · 예상 잔여 · 고갈 확률 (계약 §8, 설계서 §2·§4).

순수 산수 모듈 (모델·데이터 무관). serve.py가 LightGBM predict 결과(버킷별 λ̂·μ̂)와
실시간 잔여 s를 넣어 호출한다.

- 지평 가중합: λ_total(t,h) = Σ_b λ̂(b) × (b와 [t, t+h)의 겹침 분 / 15)
  (포아송 시간 가법성 — 지평별 별도 모델 없음. 예: t=08:10, h=15
   → 08:00버킷×5/15 + 08:15버킷×10/15)
- 예상 잔여 = s + μ_total − λ_total (원시값 — 표시용 0 클립·반올림은 serve 책임)
- 고갈 확률 = P(유출−유입 ≥ s) — Skellam(λ_total, μ_total) 꼬리.
  μ=0이면 포아송 꼬리 P(X ≥ s)로 축약. 고수요 낙관 편향(실측 1.03~1.28배)은
  9단계 캘리브레이션에서 tail_correction으로 보정 (기본 1.0).
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Mapping

import numpy as np
import pandas as pd
from scipy.stats import poisson, skellam

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config


def bucket_weights(t: pd.Timestamp, horizon_min: float) -> list[tuple[pd.Timestamp, float]]:
    """[t, t+h)가 걸치는 15분 버킷과 '겹침 분/15' 가중치 목록 (계약 §3·§8).

    가중치 합 = h/15. 정각 출발 + h=15면 정확히 한 버킷 [(t, 1.0)].
    """
    if horizon_min <= 0:
        raise ValueError(f"지평은 양수여야 함: {horizon_min}")
    end = t + pd.Timedelta(minutes=horizon_min)
    bucket = t.floor(f"{config.BUCKET_MINUTES}min")
    step = pd.Timedelta(minutes=config.BUCKET_MINUTES)
    out = []
    while bucket < end:
        overlap_min = (min(end, bucket + step) - max(t, bucket)).total_seconds() / 60
        out.append((bucket, overlap_min / config.BUCKET_MINUTES))
        bucket += step
    return out


def horizon_total(t: pd.Timestamp, horizon_min: float,
                  bucket_rates: Mapping[pd.Timestamp, float]) -> float:
    """버킷별 15분당 율(λ̂ 또는 μ̂)을 지평 가중합으로 합산.

    bucket_rates: {bucket_start: 15분당 예측 율} — serve의 '현재+다음 버킷' predict 결과.
    필요한 버킷이 없으면 KeyError (배치 구성 오류 — 조용히 넘어가면 안 됨).
    """
    total = 0.0
    for bucket, weight in bucket_weights(t, horizon_min):
        if bucket not in bucket_rates:
            raise KeyError(f"버킷 {bucket} 의 예측 율이 없음 — 대여소당 피처 행 구성(현재+다음) 확인")
        total += float(bucket_rates[bucket]) * weight
    return total


def expected_bikes(s, lambda_total, mu_total):
    """예상 잔여 = s + μ_total − λ_total (원시값 — 음수 가능, 표시 클립은 serve 책임)."""
    return np.asarray(s, dtype=float) + np.asarray(mu_total, dtype=float) - np.asarray(lambda_total, dtype=float)


def depletion_probability(s, lambda_total, mu_total, tail_correction: float = 1.0):
    """고갈 확률 P(유출−유입 ≥ s) — Skellam 꼬리 (설계서 §2 2층).

    유출 X~Poisson(λ_total), 유입 Y~Poisson(μ_total), D = X−Y일 때 P(D ≥ s).
    - s ≤ 0: 이미 고갈 → 1
    - λ_total = 0: 유출 없음 → 0
    - μ_total = 0: Skellam이 포아송으로 축약 → P(X ≥ s) = poisson.sf(s−1, λ)
    - tail_correction: 고수요 낙관 편향 보정 계수 (9단계 캘리브레이션으로 확정, 기본 1.0)
    스칼라·배열 모두 지원. 반환은 [0, 1] 클립.
    """
    s = np.asarray(s, dtype=float)
    lam = np.asarray(lambda_total, dtype=float)
    mu = np.asarray(mu_total, dtype=float)
    if (lam < 0).any() or (mu < 0).any():
        raise ValueError("λ_total·μ_total은 음수일 수 없음")

    # scipy skellam은 mu1, mu2 > 0을 요구 — 경계는 명시적으로 처리
    safe_lam = np.where(lam > 0, lam, 1.0)
    safe_mu = np.where(mu > 0, mu, 1.0)
    prob = np.where(
        s <= 0, 1.0,
        np.where(
            lam <= 0, 0.0,
            np.where(
                mu <= 0,
                poisson.sf(s - 1, safe_lam),
                skellam.sf(s - 1, safe_lam, safe_mu),
            ),
        ),
    )
    prob = np.clip(prob * tail_correction, 0.0, 1.0)
    return float(prob) if prob.ndim == 0 else prob


def predict_horizons(
    t: pd.Timestamp,
    s,
    lambda_rates: Mapping[pd.Timestamp, float],
    mu_rates: Mapping[pd.Timestamp, float],
    horizons_min: tuple[int, ...] = config.HORIZONS_MIN,
    tail_correction: float = config.TAIL_CORRECTION,
) -> dict[int, dict[str, float]]:
    """한 대여소의 지평별 (예상 잔여, 고갈 확률) — predict 1회분 율로 지평 3개는 산수.

    반환: {horizon_min: {"bikes": float, "prob_out": float}}
    """
    out = {}
    for h in horizons_min:
        lam = horizon_total(t, h, lambda_rates)
        mu = horizon_total(t, h, mu_rates)
        out[h] = {
            "bikes": float(expected_bikes(s, lam, mu)),
            "prob_out": float(depletion_probability(s, lam, mu, tail_correction)),
        }
    return out
