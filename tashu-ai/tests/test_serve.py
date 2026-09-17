# -*- coding: utf-8 -*-
"""7단계 serve 테스트 — 가동 점검 4조건 · 피처 행 구성(대여소당 2행, FEATURE_COLUMNS 순서) ·
지평 배열 계산 = probability.predict_horizons · Redis 키/TTL/값 형식.

DB·Redis 없이 돈다 (조회는 프레임 주입, Redis는 스텁). SQL 필터·TTL 소멸은 dev/ Docker 통합 검증.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src import probability, serve


def kst(s):
    return pd.Timestamp(s, tz=config.TZ)


NOW = kst("2026-09-16 17:10:00")
STATIONS = ["ST0001", "ST0002", "ST0003"]
KNOWN = frozenset(STATIONS)


def snapshots(stations=STATIONS, start_min=70, end_sec=20, bikes=10):
    """now−start_min ~ now−end_sec 45초 폴링. bikes 고정(delta=0)."""
    times = pd.date_range(NOW - pd.Timedelta(minutes=start_min), NOW - pd.Timedelta(seconds=end_sec), freq="45s")
    return pd.DataFrame({
        "station_id": np.repeat(stations, len(times)),
        "snapshot_time": pd.DatetimeIndex(np.tile(times, len(stations))).tz_convert(config.TZ),
        "bikes": bikes,
    })


def weather(hours_back=26, last_hour_back=1, rain_at=None):
    times = pd.date_range(NOW.floor("h") - pd.Timedelta(hours=hours_back),
                          NOW.floor("h") - pd.Timedelta(hours=last_hour_back), freq="h")
    df = pd.DataFrame({"obs_time": times, "temperature": 22.0, "rainfall_1h": 0.0})
    if rain_at is not None:
        df.loc[df["obs_time"] == kst(rain_at), "rainfall_1h"] = 3.0
    return df


def profile(stations=STATIONS, value=0.5):
    idx = pd.MultiIndex.from_product([stations, range(7), range(config.SLOTS_PER_DAY)],
                                     names=["station_id", "weekday", "slot_of_day"])
    df = idx.to_frame(index=False)
    df["avg_rentals"] = value
    df["avg_returns"] = value * 2
    return df


# ── 가동 점검 (데이터 담당 활성화 조건 4개) ──────────────────────────────

def test_readiness_ok():
    blockers, warnings = serve.readiness(snapshots(), weather(), NOW, KNOWN)
    assert blockers == [] and warnings == []


def test_readiness_stale_snapshot_blocks():
    """① 최신 collected_at이 2분 넘게 오래됨 (Kafka backlog 상황)."""
    blockers, _ = serve.readiness(snapshots(end_sec=180), weather(), NOW, KNOWN)
    assert any("최신 collected_at" in b for b in blockers)


def test_readiness_short_history_blocks():
    """② 이력 60분 미만 → delta_60m 불가."""
    blockers, _ = serve.readiness(snapshots(start_min=40), weather(), NOW, KNOWN)
    assert any("이력" in b and "60" in b for b in blockers)


def test_readiness_weather_under_24h_blocks():
    """③ 날씨 24시간 미확보 → minutes_since_rain 판정 불가."""
    blockers, _ = serve.readiness(snapshots(), weather(hours_back=10), NOW, KNOWN)
    assert any("weather" in b and "24" in b for b in blockers)


def test_readiness_empty_inputs_block():
    empty_snap = snapshots().iloc[0:0]
    empty_w = weather().iloc[0:0]
    blockers, _ = serve.readiness(empty_snap, empty_w, NOW, KNOWN)
    assert len(blockers) == 2


def test_readiness_unknown_station_ratio():
    """학습에 없는 대여소: 소수면 경고(콜드스타트), 절반 초과면 ID 포맷 불일치로 차단."""
    _, warnings = serve.readiness(snapshots(["ST0001", "ST0002", "NEW1"]), weather(), NOW, KNOWN)
    assert any("신규 대여소" in w for w in warnings)
    blockers, _ = serve.readiness(snapshots(["1", "2", "3"]), weather(), NOW, KNOWN)
    assert any("포맷 불일치" in b for b in blockers)


def test_readiness_stale_weather_is_warning_not_block():
    """최신 관측이 ffill 한도(3h)보다 오래돼도 차단하지 않고 경고 (날씨 NaN으로 추론)."""
    blockers, warnings = serve.readiness(snapshots(), weather(last_hour_back=5), NOW, KNOWN)
    assert blockers == []
    assert any("ffill" in w for w in warnings)


# ── 피처 행 구성 (계약 §8: 대여소당 현재+다음 버킷) ────────────────────────

def test_feature_rows_two_per_station_in_feature_order():
    rows = serve.build_feature_rows(NOW, snapshots(), profile(), weather())
    assert len(rows) == 2 * len(STATIONS)
    assert list(rows.columns[:2]) == ["station_id", "bucket_start"]
    assert all(c in rows.columns for c in config.FEATURE_COLUMNS)
    buckets = sorted(rows["bucket_start"].unique())
    assert buckets == [kst("2026-09-16 17:00"), kst("2026-09-16 17:15")]
    assert str(rows["station_id"].dtype) == "category"
    assert list(rows["holiday_type"].cat.categories) == list(config.HOLIDAY_TYPES)
    assert rows["delta_30m"].dtype == "float64"


def test_feature_rows_values_match_features_module():
    """slot/weekday/profile/delta가 학습 공용 함수와 같은 값 — 17:00 버킷 slot=68, 수요일=2."""
    rows = serve.build_feature_rows(NOW, snapshots(), profile(value=0.25), weather())
    cur = rows[rows["bucket_start"] == kst("2026-09-16 17:00")].iloc[0]
    assert cur["slot_of_day"] == 68 and cur["weekday"] == 2 and cur["holiday_type"] == "none"
    assert cur["profile_rentals"] == 0.25 and cur["profile_returns"] == 0.5
    assert cur["delta_30m"] == 0.0 and cur["delta_60m"] == 0.0  # bikes 고정
    assert cur["temperature"] == 22.0


def test_feature_rows_weather_publish_delay_and_rain():
    """17:10 < 17:40 → 16:00 관측 사용. 14시 관측에 비 → 마지막 강수 버킷 15:30 → 17:00 버킷 = 90 (Spark 정의)."""
    rows = serve.build_feature_rows(NOW, snapshots(), profile(), weather(rain_at="2026-09-16 14:00"))
    cur = rows[rows["bucket_start"] == kst("2026-09-16 17:00")].iloc[0]
    assert cur["minutes_since_rain"] == 90.0
    nxt = rows[rows["bucket_start"] == kst("2026-09-16 17:15")].iloc[0]
    assert nxt["minutes_since_rain"] == 105.0
    assert nxt["temperature"] == cur["temperature"]  # 다음 버킷도 t까지 발표된 값만 (계약 §6)


def test_extend_weather_grid_enables_tail_ffill():
    """마지막 관측(13:00) 뒤 3시간 안(16:00)은 ffill, 그 밖은 NaN — 학습과 같은 규칙을 끝단에 적용."""
    w = weather(last_hour_back=4)  # 관측은 13:00까지
    rows = serve.build_feature_rows(NOW, snapshots(), profile(), w)  # 17:10 → 16:00 관측 필요
    assert rows["temperature"].notna().all()
    later = kst("2026-09-16 18:10")  # → 17:00 필요, 13:00에서 4시간 → NaN
    rows2 = serve.build_feature_rows(later, snapshots(), profile(), w)
    assert rows2["temperature"].isna().all()


def test_feature_rows_new_station_profile_nan():
    """학습에 없던 대여소는 행 유지 + profile NaN (계약 §5)."""
    rows = serve.build_feature_rows(NOW, snapshots(["ST0001", "NEW9"]), profile(["ST0001"]), weather())
    new = rows[rows["station_id"] == "NEW9"]
    assert len(new) == 2 and new["profile_rentals"].isna().all()


# ── 지평 계산 (배열) = probability.predict_horizons (대여소별) ──────────────

def rates_frame(now, lam=(0.6, 0.9), mu=(0.3, 0.3)):
    b0 = now.floor("15min")
    b1 = b0 + pd.Timedelta(minutes=15)
    return pd.DataFrame({
        "station_id": ["ST0001", "ST0001", "ST0002", "ST0002"],
        "bucket_start": [b0, b1, b0, b1],
        "lambda_hat": [lam[0], lam[1], lam[0] * 3, lam[1] * 3],
        "mu_hat": [mu[0], mu[1], 0.0, 0.0],
    })


def test_compute_predictions_matches_predict_horizons():
    rates = rates_frame(NOW)
    s = pd.Series({"ST0001": 5, "ST0002": 1})
    preds = serve.compute_predictions(NOW, rates, s)
    assert len(preds) == 2 * len(config.HORIZONS_MIN)
    for sid in s.index:
        g = rates[rates["station_id"] == sid]
        ref = probability.predict_horizons(NOW, int(s[sid]), dict(zip(g["bucket_start"], g["lambda_hat"])),
                                           dict(zip(g["bucket_start"], g["mu_hat"])))
        for h, v in ref.items():
            row = preds[(preds["station_id"] == sid) & (preds["horizon_min"] == h)].iloc[0]
            assert row["bikes"] == pytest.approx(round(max(v["bikes"], 0.0), 1))
            assert row["prob_out"] == pytest.approx(round(v["prob_out"], 3))


def test_compute_predictions_clips_bikes_and_skips_missing_s():
    rates = rates_frame(NOW, lam=(30.0, 30.0), mu=(0.0, 0.0))
    preds = serve.compute_predictions(NOW, rates, pd.Series({"ST0001": 2}))  # ST0002는 s 없음 → 제외
    assert set(preds["station_id"]) == {"ST0001"}
    assert (preds["bikes"] >= 0).all() and preds["bikes"].max() == 0.0
    # 1분 지평은 λ_total이 작아 0.99를 못 넘는 게 정상 — 지평별 단조 증가 + 5분 이상 임계로 검증
    ordered = preds.sort_values("horizon_min")["prob_out"]
    assert (ordered.diff().dropna() >= 0).all()
    assert (preds.loc[preds["horizon_min"] >= 5, "prob_out"] > 0.99).all()


def test_compute_predictions_requires_next_bucket():
    rates = rates_frame(NOW).iloc[[0, 2]]  # 현재 버킷만
    with pytest.raises(KeyError):
        serve.compute_predictions(NOW, rates, pd.Series({"ST0001": 5, "ST0002": 1}))


def test_current_bikes_uses_last_snapshot_before_now():
    snaps = snapshots(["ST0001"], start_min=70, end_sec=20, bikes=4)
    snaps.loc[snaps.index[-1], "bikes"] = 9
    assert serve.current_bikes(snaps, NOW)["ST0001"] == 9
    before_last = snaps["snapshot_time"].iloc[-1] - pd.Timedelta(seconds=1)
    assert serve.current_bikes(snaps, before_last)["ST0001"] == 4


# ── Redis 적재 형식 ─────────────────────────────────────────────────────

class _Pipe:
    def __init__(self):
        self.calls = []

    def set(self, key, value, ex=None):
        self.calls.append((key, value, ex))

    def execute(self):
        return [True] * len(self.calls)


class _RedisStub:
    def __init__(self):
        self.pipe = _Pipe()

    def pipeline(self, transaction=False):
        return self.pipe


def test_write_redis_key_ttl_value():
    preds = serve.compute_predictions(NOW, rates_frame(NOW), pd.Series({"ST0001": 5, "ST0002": 1}))
    stub = _RedisStub()
    n = serve.write_redis(stub, preds, NOW)
    assert n == len(preds) == len(stub.pipe.calls)
    keys = {c[0] for c in stub.pipe.calls}
    assert keys == {f"pred:{sid}:{h}" for sid in ("ST0001", "ST0002") for h in config.HORIZONS_MIN}
    key, value, ex = stub.pipe.calls[0]
    assert ex == config.REDIS_TTL_SECONDS
    payload = json.loads(value)
    assert set(payload) == {"bikes", "prob_out", "updated_at"}
    assert payload["updated_at"] == "2026-09-16T17:10:00+09:00"


# ── 시간대 변환 (UTC 저장 → KST) ─────────────────────────────────────────

def test_utc_roundtrip():
    """MySQL(UTC 세션)에서 읽은 naive 05:00 = KST 14:00. 파라미터도 UTC naive로 나간다."""
    from datetime import datetime
    assert serve._to_kst([datetime(2026, 9, 16, 5, 0)]).iloc[0] == kst("2026-09-16 14:00")
    assert serve._utc_param(kst("2026-09-16 14:00")) == datetime(2026, 9, 16, 5, 0)


# ── 실모델 통합 (아티팩트 있을 때만) ─────────────────────────────────────

needs_models = pytest.mark.skipif(
    not (config.MODELS_DIR / "lgbm_lambda.joblib").exists() or not config.PROFILE_PATH.exists(),
    reason="모델 아티팩트 없음",
)


@needs_models
def test_real_models_full_cycle_under_budget():
    """완료 기준: 전 대여소 × 3지평 계산 (DB 조회 제외) < SERVE_TIME_BUDGET_SECONDS."""
    import time
    art = serve.load_artifacts()
    stations = sorted(art.known_stations)
    snaps = snapshots(stations, bikes=6)
    t0 = time.monotonic()
    rows = serve.build_feature_rows(NOW, snaps, art.profile, weather())
    rates = serve.predict_rates(art, rows)
    preds = serve.compute_predictions(NOW, rates, serve.current_bikes(snaps, NOW))
    elapsed = time.monotonic() - t0
    assert len(preds) == len(stations) * len(config.HORIZONS_MIN)
    assert (rates[["lambda_hat", "mu_hat"]] >= 0).all().all()
    assert preds["prob_out"].between(0, 1).all()
    assert elapsed < config.SERVE_TIME_BUDGET_SECONDS, f"{elapsed:.2f}s"
