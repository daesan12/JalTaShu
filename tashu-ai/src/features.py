# -*- coding: utf-8 -*-
"""3단계: 학습·서빙 공용 피처 생성 — 이 모듈이 심장이다.

학습 파이프라인(train.py)과 서빙(serve.py)이 **같은 함수를 import**해서 train/serve
일치를 구조적으로 보장한다 (구현 가이드). 피처 정의는 docs/피처_스키마_계약.md가 기준.

정적 피처(3단계): slot_of_day · weekday · holiday_type · 날씨 발표 지연 정렬
(temperature/rainfall_1h/minutes_since_rain) · 프로파일 조인.
delta(4단계): add_train_delta(학습 — 버킷 시계열) · snapshot_delta(서빙 — 스냅샷 재현).

날씨 규칙 (계약 §6):
- weather_available(t) = obs(H) if t ≥ H:40 else obs(H−1) — 시점 t에 발표돼 있던 관측만.
- 결측은 직전 값 유지(ffill) 최대 3시간, 그 이상 NaN. NaN은 채우지 않는다.
- minutes_since_rain: available 기준 파생. 비 오는 중(≥1mm/h)=0, 상한 1440 클립.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import holidays as _holidays

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config


# ── 달력 피처 ───────────────────────────────────────────────────────────

def slot_of_day(ts: pd.Series) -> pd.Series:
    """0~95 (= hour×4 + minute÷15). 계약 §1."""
    return (ts.dt.hour * 4 + ts.dt.minute // config.BUCKET_MINUTES).astype("int16")


def weekday(ts: pd.Series) -> pd.Series:
    """0=월 ~ 6=일 (KST 벽시계 기준). 계약 §1. is_weekend 파생 금지 — 트리가 스스로 분할."""
    return ts.dt.weekday.astype("int8")


def holiday_type(ts: pd.Series) -> pd.Series:
    """none / major(설·추석) / regular / substitute / workers_day. 계약 §1.

    holidays 패키지 명칭 실측('설날 전날', '추석 대체 휴일' 등) 기반 분류:
    '대체' → substitute가 '설날'·'추석' 포함 여부보다 우선한다.
    근로자의 날(5/1)은 관공서 공휴일이 아니라 패키지에 없으므로 날짜 규칙으로 처리.
    임시공휴일(예: 2025-01-27)은 **regular로 확정** (계약 §1, 2026-09-14 합의 — 양쪽 동일).
    """
    dates = ts.dt.normalize().dt.tz_localize(None)
    unique_dates = dates.unique()
    years = sorted({d.year for d in unique_dates})
    kr = _holidays.KR(years=years)

    def classify(d) -> str:
        if d.month == 5 and d.day == 1:
            return "workers_day"
        name = kr.get(d.date())
        if name is None:
            return "none"
        if "대체" in name:
            return "substitute"
        if "설날" in name or "추석" in name:
            return "major"
        return "regular"

    mapping = {d: classify(d) for d in unique_dates}
    return dates.map(mapping).astype("category")


# ── 날씨 발표 지연 정렬 (계약 §6) ────────────────────────────────────────

def effective_obs_hour(ts: pd.Series) -> pd.Series:
    """시점 t에 발표돼 있던 정시 관측의 시각: t ≥ H:40 → H, 아니면 H−1."""
    hour = ts.dt.floor("h")
    return hour.where(ts.dt.minute >= config.WEATHER_PUBLISH_MINUTE, hour - pd.Timedelta(hours=1))


def prepare_weather(weather_obs: pd.DataFrame) -> pd.DataFrame:
    """정시 관측 테이블(obs_time, temperature, rainfall_1h) → 시간 격자 정규화.

    - 전체 시간 범위로 reindex 후 ffill 최대 3시간 (초과 결측은 NaN 유지)
    - last_rain_time: 강수(≥1mm/h) 정시 관측의 마지막 시각 (minutes_since_rain 파생용)
    """
    obs = (
        weather_obs[["obs_time", "temperature", "rainfall_1h"]]
        .dropna(subset=["obs_time"])
        .sort_values("obs_time")
        .set_index("obs_time")
    )
    full = pd.date_range(obs.index.min(), obs.index.max(), freq="h")
    obs = obs.reindex(full)
    obs[["temperature", "rainfall_1h"]] = obs[["temperature", "rainfall_1h"]].ffill(
        limit=config.WEATHER_FFILL_MAX_HOURS
    )
    rainy = obs["rainfall_1h"] >= config.RAIN_THRESHOLD_MMH
    obs["last_rain_time"] = pd.Series(obs.index, index=obs.index).where(rainy).ffill()
    return obs


def align_weather(ts: pd.Series, prepared: pd.DataFrame) -> pd.DataFrame:
    """시점 벡터 ts에 발표 지연 정렬된 날씨 3피처를 붙인다 (ts와 같은 index로 반환).

    minutes_since_rain:
    - 현재 available 강수 ≥ 1mm/h → 0 (비 오는 중)
    - 아니면 t − 마지막 강수 관측 시각, 상한 1440 클립
    - 관측 이력 내 강수가 없으면: 이력이 1440분 이상이면 1440, 아니면 NaN (판단 불가)
    - 현재 강수값이 NaN이면 NaN ('비 오는 중' 판정 불가 — 결측은 채우지 않는다)
    """
    eff = effective_obs_hour(ts)
    rows = prepared.reindex(eff)  # 아카이브 범위 밖 → 전 컬럼 NaN
    # .array: tz-aware dtype 보존 (.to_numpy()는 tz를 벗겨 naive로 만든다 — 절대 규칙 위반)
    temperature = pd.Series(rows["temperature"].array, index=ts.index)
    rainfall = pd.Series(rows["rainfall_1h"].array, index=ts.index)
    last_rain = pd.Series(rows["last_rain_time"].array, index=ts.index)

    minutes = (ts - last_rain).dt.total_seconds() / 60
    minutes = minutes.clip(upper=config.MINUTES_SINCE_RAIN_CAP)

    archive_start = prepared.index.min()
    history_min = (ts - archive_start).dt.total_seconds() / 60
    no_rain_known = last_rain.isna()
    minutes = minutes.mask(no_rain_known & (history_min >= config.MINUTES_SINCE_RAIN_CAP),
                           config.MINUTES_SINCE_RAIN_CAP)
    minutes = minutes.mask(no_rain_known & (history_min < config.MINUTES_SINCE_RAIN_CAP), np.nan)
    minutes = minutes.mask(rainfall >= config.RAIN_THRESHOLD_MMH, 0.0)
    minutes = minutes.mask(rainfall.isna(), np.nan)

    return pd.DataFrame(
        {"temperature": temperature, "rainfall_1h": rainfall, "minutes_since_rain": minutes}
    )


# ── delta (계약 §2 학습 / §8 서빙) ──────────────────────────────────────

def add_train_delta(buckets: pd.DataFrame) -> pd.DataFrame:
    """학습 테이블에 delta_30m/delta_60m 추가 — 계약 §2.

    정의: 직전 N분 순변화 = 직전 N분 returns 합 − rentals 합. 버킷 경계 기준,
    자기 버킷 미포함 (bucket_start 이전 N분). NaN 규칙(학습·서빙 동일):
    - 직전 N분이 연속 관측이 아니면(운영 시작·마스크 공백·이력 부족) NaN
    - |delta| > 20 → 재배치 간주 NaN
    (station_id, bucket_start) 정렬본을 반환한다. 검증 초입이 학습 구간의 과거를
    참조하는 것은 허용 — 분할 전에 전체 시계열로 계산할 것 (계약 §7).
    """
    df = buckets.sort_values(["station_id", "bucket_start"]).reset_index(drop=True)
    net = (df["returns"] - df["rentals"]).astype("float64")
    # 연속 런: 같은 대여소에서 직전 버킷과 정확히 15분 간격이 아닌 지점마다 새 런 시작
    gap = df.groupby("station_id", observed=True)["bucket_start"].diff()
    run_id = (gap != pd.Timedelta(minutes=config.BUCKET_MINUTES)).cumsum()
    prev_net = net.groupby(run_id).shift(1)  # 자기 버킷 미포함
    for minutes in config.DELTA_WINDOWS_MIN:
        k = minutes // config.BUCKET_MINUTES
        rolled = prev_net.groupby(run_id).rolling(k, min_periods=k).sum().droplevel(0)
        rolled = rolled.mask(rolled.abs() > config.DELTA_REBALANCE_ABS)
        df[f"delta_{minutes}m"] = rolled
    return df


def snapshot_delta(
    t: pd.Timestamp,
    snapshots: pd.DataFrame,
    windows_min: tuple[int, ...] = config.DELTA_WINDOWS_MIN,
) -> pd.DataFrame:
    """서빙 delta 재현 — 계약 §8: delta_Nm(t) = bikes(t 직전 스냅샷) − bikes(t−N분 직전 스냅샷).

    snapshots: columns [station_id, snapshot_time(KST aware), bikes] — 45초 폴링 이력.
    - 각 기준 시각의 '직전'(과거 방향) 스냅샷만 사용, 허용 오차 ±3분 초과 시 NaN
      (미래 방향 매칭 금지 — 백테스트 리플레이에서도 누출이 없도록)
    - |delta| > 20 → NaN (재배치)
    - 수집기 기동(최초 스냅샷) 후 60분 미만이면 전부 NaN
    반환: station_id + delta_{N}m 컬럼. NaN은 채우지 않는다.
    """
    stations = pd.DataFrame({"station_id": snapshots["station_id"].unique()})
    cols = {f"delta_{m}m": np.nan for m in windows_min}
    if stations.empty:
        return stations.assign(**cols)
    warmup_end = snapshots["snapshot_time"].min() + pd.Timedelta(minutes=config.DELTA_WARMUP_MINUTES)
    if t < warmup_end:
        return stations.assign(**cols)

    snaps = snapshots.sort_values("snapshot_time")
    tolerance = pd.Timedelta(minutes=config.SNAPSHOT_MATCH_TOLERANCE_MIN)

    def bikes_before(target: pd.Timestamp) -> pd.Series:
        left = stations.assign(_t=target)
        matched = pd.merge_asof(
            left, snaps, left_on="_t", right_on="snapshot_time",
            by="station_id", direction="backward", tolerance=tolerance,
        )
        return matched["bikes"]

    out = stations.copy()
    bikes_now = bikes_before(t)
    for minutes in windows_min:
        delta = bikes_now - bikes_before(t - pd.Timedelta(minutes=minutes))
        out[f"delta_{minutes}m"] = delta.mask(delta.abs() > config.DELTA_REBALANCE_ABS)
    return out


# ── 프로파일 조인 (계약 §5) ──────────────────────────────────────────────

def join_profile(df: pd.DataFrame, profile: pd.DataFrame) -> pd.DataFrame:
    """station×weekday×slot으로 profile_rentals/returns 조인.

    신규 대여소(프로파일 결측)는 행 유지 + NaN 그대로 (계약 §5 — 대체값 주입 금지).
    """
    keys = ["station_id", "weekday", "slot_of_day"]
    prof = profile[keys + ["avg_rentals", "avg_returns"]].rename(
        columns={"avg_rentals": "profile_rentals", "avg_returns": "profile_returns"}
    )
    left = df.copy()
    left["station_id"] = left["station_id"].astype(str)
    prof["station_id"] = prof["station_id"].astype(str)
    return left.merge(prof, on=keys, how="left")


# ── 공용 진입점 ─────────────────────────────────────────────────────────

def add_static_features(
    df: pd.DataFrame,
    profile: pd.DataFrame | None = None,
    weather_obs: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """학습 테이블·서빙 피처 행에 정적 피처를 붙인다 — train.py와 serve.py가 이 함수를 공용.

    df: station_id, bucket_start(KST aware) 필수. 날씨/프로파일이 없으면 해당 컬럼 NaN
    (결측은 채우지 않는다 — LightGBM 자체 처리).
    """
    out = df.copy()
    ts = out["bucket_start"]
    out["slot_of_day"] = slot_of_day(ts)
    out["weekday"] = weekday(ts)
    out["holiday_type"] = holiday_type(ts)

    if weather_obs is not None:
        weather = align_weather(ts, prepare_weather(weather_obs))
        out[["temperature", "rainfall_1h", "minutes_since_rain"]] = weather
    else:
        out["temperature"] = np.nan
        out["rainfall_1h"] = np.nan
        out["minutes_since_rain"] = np.nan

    if profile is not None:
        out = join_profile(out, profile)
    else:
        out["profile_rentals"] = np.nan
        out["profile_returns"] = np.nan
    return out
