# -*- coding: utf-8 -*-
"""3단계 features 단위 테스트 — 날씨 발표 지연 정렬(완료 기준)·달력 피처·프로파일 조인."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src.features import (
    add_static_features,
    align_weather,
    effective_obs_hour,
    holiday_type,
    join_profile,
    prepare_weather,
    slot_of_day,
    weekday,
)


def kst(s):
    return pd.Timestamp(s, tz=config.TZ)


def ts_series(*items):
    return pd.Series([kst(s) for s in items])


# ── 달력 피처 ───────────────────────────────────────────────────────────

def test_slot_of_day():
    out = slot_of_day(ts_series("2024-06-05 00:00", "2024-06-05 08:10", "2024-06-05 08:15", "2024-06-05 23:45"))
    assert list(out) == [0, 32, 33, 95]


def test_weekday_monday_is_zero():
    out = weekday(ts_series("2024-06-03 10:00", "2024-06-05 10:00", "2024-06-09 10:00"))
    assert list(out) == [0, 2, 6]  # 월·수·일


def test_holiday_type_categories():
    out = holiday_type(
        ts_series(
            "2024-02-10 08:00",  # 설날 → major
            "2024-02-09 08:00",  # 설날 전날 → major
            "2024-02-12 08:00",  # 설날 대체 휴일 → substitute
            "2024-05-05 08:00",  # 어린이날 → regular
            "2024-05-06 08:00",  # 어린이날 대체 휴일 → substitute
            "2024-05-01 08:00",  # 근로자의 날 → workers_day (패키지에 없어 날짜 규칙)
            "2025-01-27 08:00",  # 임시공휴일 → 잠정 regular (Spark 정렬 — 합의 항목)
            "2024-06-05 08:00",  # 평일 → none
        )
    )
    assert list(out) == ["major", "major", "substitute", "regular", "substitute", "workers_day", "regular", "none"]


# ── 날씨 발표 지연 정렬 (계약 §6 — 완료 기준 단위 테스트) ─────────────────

def obs_frame(rows):
    return pd.DataFrame(
        {"obs_time": [kst(t) for t, _, _ in rows],
         "temperature": [x for _, x, _ in rows],
         "rainfall_1h": [r for _, _, r in rows]}
    )


def test_effective_obs_hour_publish_delay_rule():
    """t ≥ H:40 → obs(H), t < H:40 → obs(H−1). 경계 08:40:00은 obs(08)."""
    out = effective_obs_hour(ts_series("2024-06-05 08:39:59", "2024-06-05 08:40:00", "2024-06-05 08:00:00"))
    assert list(out) == [kst("2024-06-05 07:00"), kst("2024-06-05 08:00"), kst("2024-06-05 07:00")]


def test_align_weather_uses_only_published_obs():
    prepared = prepare_weather(obs_frame([("2024-06-05 07:00", 20.0, 0.0), ("2024-06-05 08:00", 25.0, 0.0)]))
    w = align_weather(ts_series("2024-06-05 08:30", "2024-06-05 08:45"), prepared)
    assert w["temperature"].tolist() == [20.0, 25.0]  # 08:30은 아직 08시 관측 미발표


def test_weather_ffill_limit_3h():
    # 09~12시 관측 누락: 10·11·12시(≤3h)는 06...아니라 08시 값 유지, 13시 관측 복귀 전 12시까지가 한계
    prepared = prepare_weather(
        obs_frame([("2024-06-05 08:00", 25.0, 0.0), ("2024-06-05 13:00", 30.0, 0.0)])
    )
    w = align_weather(ts_series("2024-06-05 11:50", "2024-06-05 12:50"), prepared)  # eff=11시(ffill 3h째), 12시(4h째)
    assert w["temperature"].iloc[0] == 25.0
    assert np.isnan(w["temperature"].iloc[1])


def test_minutes_since_rain_raining_now_is_zero():
    prepared = prepare_weather(obs_frame([("2024-06-05 08:00", 20.0, 3.0)]))
    w = align_weather(ts_series("2024-06-05 08:50"), prepared)
    assert w["minutes_since_rain"].iloc[0] == 0.0


def test_minutes_since_rain_elapsed_from_last_rainy_bucket():
    """기준점은 관측 시각(06:00)이 아니라 06시 관측이 available이던 마지막 버킷(07:30) — Spark 정의."""
    prepared = prepare_weather(
        obs_frame([("2024-06-05 06:00", 20.0, 2.0), ("2024-06-05 07:00", 20.0, 0.0), ("2024-06-05 08:00", 20.0, 0.0)])
    )
    w = align_weather(ts_series("2024-06-05 08:50"), prepared)  # eff=08시, 마지막 강수 06시 관측
    assert w["minutes_since_rain"].iloc[0] == 80.0  # 08:50 − 07:30


def test_minutes_since_rain_matches_spark_example():
    """Spark train_buckets 2026-01-10 실측: 08시 2.7mm, 09시 0.1mm → 08:45~09:30 = 0, 09:45 = 15, 10:00 = 30."""
    prepared = prepare_weather(
        obs_frame([("2026-01-10 07:00", 4.1, 0.0), ("2026-01-10 08:00", 3.7, 2.7), ("2026-01-10 09:00", 4.4, 0.1)])
    )
    w = align_weather(ts_series("2026-01-10 08:45", "2026-01-10 09:30", "2026-01-10 09:45", "2026-01-10 10:00"), prepared)
    assert w["minutes_since_rain"].tolist() == [0.0, 0.0, 15.0, 30.0]
    assert w["rainfall_1h"].tolist() == [2.7, 2.7, 0.1, 0.1]


def test_minutes_since_rain_capped_at_1440():
    hourly_zero = [
        (f"2024-06-0{d} {h:02d}:00", 20.0, 0.0)
        for d in (1, 2, 3)
        for h in range(0, 24)
        if not (d == 1 and h <= 6)
    ]
    prepared = prepare_weather(obs_frame([("2024-06-01 06:00", 20.0, 5.0)] + hourly_zero))
    w = align_weather(ts_series("2024-06-03 20:50"), prepared)  # 마지막 강수 후 62.8시간
    assert w["minutes_since_rain"].iloc[0] == config.MINUTES_SINCE_RAIN_CAP


def test_minutes_since_rain_no_rain_history():
    obs = obs_frame([(f"2024-06-0{d} {h:02d}:00", 20.0, 0.0) for d in (1, 2, 3) for h in range(0, 24, 1)])
    prepared = prepare_weather(obs)
    w = align_weather(ts_series("2024-06-01 05:50", "2024-06-03 10:50"), prepared)
    assert np.isnan(w["minutes_since_rain"].iloc[0])  # 이력 6시간 — 무강수 확정 불가
    assert w["minutes_since_rain"].iloc[1] == config.MINUTES_SINCE_RAIN_CAP  # 이력 ≥ 1440분


def test_minutes_since_rain_counts_through_unknown_current_rain():
    """강수값이 NaN(ffill 3h 초과)이어도 '비 아님'으로 보고 경과분은 계속 센다 (Spark 동일)."""
    prepared = prepare_weather(
        obs_frame([("2024-06-05 00:00", 20.0, 2.0), ("2024-06-05 01:00", 20.0, 0.0)])
    )
    w = align_weather(ts_series("2024-06-05 06:50"), prepared)  # eff=06시: ffill 한도(3h) 초과 → 강수 NaN
    assert np.isnan(w["rainfall_1h"].iloc[0])
    assert w["minutes_since_rain"].iloc[0] == 320.0  # 06:50 − 01:30 (00시 관측의 마지막 available 버킷)


# ── 프로파일 조인·진입점 ─────────────────────────────────────────────────

def make_profile():
    return pd.DataFrame(
        {"station_id": ["ST0001"], "weekday": [2], "slot_of_day": [33],
         "avg_rentals": [1.5], "avg_returns": [0.7]}
    )


def test_join_profile_missing_station_stays_nan():
    """신규 대여소는 행 유지 + NaN 그대로 (계약 §5 — 대체값 주입 금지)."""
    df = pd.DataFrame(
        {"station_id": ["ST0001", "ST9999"], "weekday": [2, 2], "slot_of_day": [33, 33]}
    )
    out = join_profile(df, make_profile())
    assert out["profile_rentals"].tolist()[0] == 1.5
    assert np.isnan(out["profile_rentals"].iloc[1]) and len(out) == 2


def test_add_static_features_without_weather_and_profile_is_nan():
    df = pd.DataFrame({"station_id": ["ST0001"], "bucket_start": [kst("2024-06-05 08:15")]})
    out = add_static_features(df)
    assert out.loc[0, "slot_of_day"] == 33 and out.loc[0, "weekday"] == 2
    assert str(out.loc[0, "holiday_type"]) == "none"
    for col in ("temperature", "rainfall_1h", "minutes_since_rain", "profile_rentals", "profile_returns"):
        assert np.isnan(out.loc[0, col])


def test_add_static_features_full_assembly():
    df = pd.DataFrame({"station_id": ["ST0001"], "bucket_start": [kst("2024-06-05 08:15")]})
    weather = obs_frame([("2024-06-05 07:00", 21.5, 0.0)])
    out = add_static_features(df, profile=make_profile(), weather_obs=weather)
    assert out.loc[0, "temperature"] == 21.5
    assert out.loc[0, "profile_rentals"] == 1.5 and out.loc[0, "profile_returns"] == 0.7
