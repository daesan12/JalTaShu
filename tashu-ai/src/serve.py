# -*- coding: utf-8 -*-
"""7단계: 매분 배치 추론 → Redis (계약 §8, 설계서 §2 3층).

1회 실행 흐름:
  MySQL(최근 65분 완전 snapshot · 24시간+ 날씨, UTC 저장 → KST 변환)
  → 가동 점검 4조건 (실패 시 Redis에 쓰지 않고 로그만 — 낡은 키는 TTL로 자연 소멸)
  → 대여소당 피처 행 2개(현재·다음 버킷) = features.add_static_features + features.snapshot_delta
  → λ·μ predict 각 1회 → probability.predict_horizons (5/10/15분은 산수)
  → Redis pred:{station_id}:{horizon_min} = {bikes, prob_out, updated_at}, EX=REDIS_TTL_SECONDS

current_bikes는 피처가 아니다 — 2층 수식의 s (계약 §1). 접속 정보는 환경변수만 사용한다
(config.DB_ENV · REDIS_ENV — 비밀번호를 코드·Git에 두지 않는다).
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src import features, probability

log = logging.getLogger("tashu.serve")


# ── 아티팩트 (모델 3파일) ────────────────────────────────────────────────

@dataclass
class Artifacts:
    lambda_model: object
    mu_model: object
    profile: pd.DataFrame
    known_stations: frozenset  # 학습 구간에 존재한 대여소 (profile 기준) — ID 포맷 불일치 감지용


def load_artifacts(models_dir: Path = config.MODELS_DIR,
                   profile_path: Path = config.PROFILE_PATH) -> Artifacts:
    lam = joblib.load(models_dir / "lgbm_lambda.joblib")
    mu = joblib.load(models_dir / "lgbm_mu.joblib")
    profile = pd.read_parquet(profile_path)
    profile["station_id"] = profile["station_id"].astype(str)
    return Artifacts(lam, mu, profile, frozenset(profile["station_id"].unique()))


# ── 접속 (환경변수만) ────────────────────────────────────────────────────

def load_env_file(path: str | Path) -> None:
    """KEY=VALUE 파일을 환경변수로 (이미 설정된 키는 유지). Docker --env-file과 같은 형식."""
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"환경변수 {name} 없음 — 인프라 Secret 주입 확인")
    return value


def db_connect():
    import pymysql
    v = config.DB_ENV
    return pymysql.connect(
        host=_require_env(v["host"]),
        port=int(os.environ.get(v["port"], "3306")),
        database=_require_env(v["name"]),
        user=_require_env(v["user"]),
        password=_require_env(v["password"]),
        charset="utf8mb4",
        init_command="SET SESSION time_zone = '+00:00'",  # 저장 규약: UTC (infra/mysql/README)
        # 연결을 루프 내내 재사용한다. autocommit이 없으면 첫 SELECT가 연 트랜잭션이 닫히지 않아
        # REPEATABLE READ 스냅샷에 갇혀 이후 주기가 새 행을 못 본다 (운영 첫 기동에서 실측 — 키 0개).
        autocommit=True,
    )


def redis_connect():
    import redis
    v = config.REDIS_ENV
    return redis.Redis(
        host=_require_env(v["host"]),
        port=int(os.environ.get(v["port"], "6379")),
        db=int(os.environ.get(v["db"], "0")),
        password=os.environ.get(v["password"]) or None,
        decode_responses=True,
    )


# ── 조회 (UTC → KST) ─────────────────────────────────────────────────────

def _utc_param(ts: pd.Timestamp):
    """KST aware → UTC naive datetime (세션 time_zone=+00:00 인 MySQL 비교용)."""
    return ts.tz_convert("UTC").tz_localize(None).to_pydatetime()


def _to_kst(values) -> pd.Series:
    """UTC 세션으로 읽은 naive TIMESTAMP → Asia/Seoul aware."""
    return pd.to_datetime(pd.Series(values)).dt.tz_localize("UTC").dt.tz_convert(config.TZ)


def _query(conn, sql: str, params: tuple, columns: list[str]) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return pd.DataFrame(list(cur.fetchall()), columns=columns)


# 완전 snapshot만 (조건 ④): 같은 snapshot_id의 행 수 = station_count
SNAPSHOT_SQL = f"""
SELECT s.station_id, s.collected_at, s.bikes
FROM {config.SNAPSHOT_TABLE} s
JOIN (
    SELECT snapshot_id
    FROM {config.SNAPSHOT_TABLE}
    WHERE collected_at >= %s AND collected_at < %s
    GROUP BY snapshot_id, station_count
    HAVING COUNT(*) = station_count
) c ON c.snapshot_id = s.snapshot_id
WHERE s.collected_at >= %s AND s.collected_at < %s
"""

WEATHER_SQL = f"""
SELECT observed_at, temperature, rainfall_1h
FROM {config.WEATHER_TABLE}
WHERE observed_at >= %s AND observed_at < %s
ORDER BY observed_at
"""


def fetch_snapshots(conn, now: pd.Timestamp) -> pd.DataFrame:
    """최근 SNAPSHOT_HISTORY_MIN분의 완전 snapshot → [station_id, snapshot_time(KST), bikes]."""
    since, until = _utc_param(now - pd.Timedelta(minutes=config.SNAPSHOT_HISTORY_MIN)), _utc_param(now)
    raw = _query(conn, SNAPSHOT_SQL, (since, until, since, until), ["station_id", "collected_at", "bikes"])
    return pd.DataFrame({
        "station_id": raw["station_id"].astype(str),
        "snapshot_time": _to_kst(raw["collected_at"]),
        "bikes": raw["bikes"].astype("int64"),
    })


def fetch_weather(conn, now: pd.Timestamp) -> pd.DataFrame:
    """정시 관측 → [obs_time(KST), temperature, rainfall_1h] (prepare_weather 입력 형식).

    weather-collector가 발표 지연 규칙(H:40)을 이미 적용해 observed_at을 정시 관측 시각으로
    저장하므로 컬럼 매핑만 한다. 격자점(nx, ny)이 둘 이상이면 시각당 첫 행 사용 (현재 대전 1점).
    """
    hours = config.WEATHER_HISTORY_HOURS + config.WEATHER_FFILL_MAX_HOURS + 1
    since, until = _utc_param(now - pd.Timedelta(hours=hours)), _utc_param(now)
    raw = _query(conn, WEATHER_SQL, (since, until), ["observed_at", "temperature", "rainfall_1h"])
    out = pd.DataFrame({
        "obs_time": _to_kst(raw["observed_at"]),
        "temperature": raw["temperature"].astype("float64"),
        "rainfall_1h": raw["rainfall_1h"].astype("float64"),
    })
    return out.drop_duplicates("obs_time", keep="first").reset_index(drop=True)


def extend_weather_to(weather: pd.DataFrame, now: pd.Timestamp) -> pd.DataFrame:
    """now 시점에 발표돼 있어야 할 정시까지 격자를 늘려 ffill(≤3h)이 끝단에도 적용되게 한다.

    학습 아카이브는 전 구간을 덮어 이 문제가 없고, 서빙은 마지막 관측 뒤가 잘린다.
    의미는 학습과 동일 (결측 ≤3시간 ffill, 초과 NaN — 계약 §6).
    """
    if weather.empty:
        return weather
    eff = features.effective_obs_hour(pd.Series([now])).iloc[0]
    if eff <= weather["obs_time"].max():
        return weather
    pad = pd.DataFrame({"obs_time": [eff], "temperature": [np.nan], "rainfall_1h": [np.nan]})
    return pd.concat([weather, pad], ignore_index=True)


# ── 가동 점검 (데이터 담당 활성화 조건, 2026-09-16) ────────────────────────

def readiness(snapshots: pd.DataFrame, weather: pd.DataFrame, now: pd.Timestamp,
              known_stations: frozenset) -> tuple[list[str], list[str]]:
    """(차단 사유, 경고) — 차단 사유가 하나라도 있으면 Redis에 쓰지 않는다."""
    blockers, warnings = [], []
    if snapshots.empty:
        blockers.append("snapshot: 조회 결과 없음 (완전 snapshot 기준)")
    else:
        latest, earliest = snapshots["snapshot_time"].max(), snapshots["snapshot_time"].min()
        age_min = (now - latest).total_seconds() / 60
        if age_min > config.SNAPSHOT_MAX_AGE_MIN:  # ①
            blockers.append(f"snapshot: 최신 collected_at {latest:%Y-%m-%d %H:%M:%S %Z} = {age_min:.1f}분 전 "
                            f"(허용 {config.SNAPSHOT_MAX_AGE_MIN}분)")
        need_min = max(config.DELTA_WINDOWS_MIN)
        span_min = (latest - earliest).total_seconds() / 60
        if span_min < need_min:  # ②
            blockers.append(f"snapshot: 이력 {span_min:.0f}분 < {need_min}분 (delta_{need_min}m 계산 불가)")

        stations = snapshots["station_id"].unique()
        unknown = [s for s in stations if s not in known_stations]
        ratio = len(unknown) / len(stations)
        if ratio > config.UNKNOWN_STATION_MAX_RATIO:
            blockers.append(f"station_id 포맷 불일치 의심: 학습에 없는 대여소 {len(unknown)}/{len(stations)} "
                            f"(예: {unknown[:3]}) — 학습 형식 예: {sorted(known_stations)[:2]}")
        elif unknown:
            warnings.append(f"신규 대여소 {len(unknown)}곳 profile NaN 추론 (계약 §5 콜드스타트): {unknown[:5]}")

    if weather.empty:
        blockers.append("weather: 조회 결과 없음")
    else:
        if weather["obs_time"].min() > now - pd.Timedelta(hours=config.WEATHER_HISTORY_HOURS):  # ③
            blockers.append(f"weather: 이력 시작 {weather['obs_time'].min():%m-%d %H:%M} — "
                            f"{config.WEATHER_HISTORY_HOURS}시간 미확보 (minutes_since_rain 판정 불가)")
        stale_h = (now - weather["obs_time"].max()).total_seconds() / 3600
        if stale_h > config.WEATHER_FFILL_MAX_HOURS + 1:
            warnings.append(f"weather: 최신 관측 {stale_h:.1f}시간 전 — ffill 한도 초과로 날씨 피처 NaN 추론")
    return blockers, warnings


# ── 피처 행 → predict → 지평 ─────────────────────────────────────────────

def build_feature_rows(now: pd.Timestamp, snapshots: pd.DataFrame, profile: pd.DataFrame,
                       weather: pd.DataFrame | None) -> pd.DataFrame:
    """대여소당 현재·다음 버킷 행 2개 (계약 §8) — 학습과 같은 features 함수로 생성.

    반환 컬럼: station_id(category), bucket_start + FEATURE_COLUMNS 전부.
    """
    stations = pd.Index(snapshots["station_id"].unique(), name="station_id")
    b0 = now.floor(f"{config.BUCKET_MINUTES}min")
    buckets = pd.DatetimeIndex([b0, b0 + pd.Timedelta(minutes=config.BUCKET_MINUTES)], name="bucket_start")
    rows = pd.MultiIndex.from_product([stations, buckets]).to_frame(index=False)

    weather_obs = None if weather is None or weather.empty else extend_weather_to(weather, now)
    rows = features.add_static_features(rows, profile=profile, weather_obs=weather_obs)
    rows = rows.merge(features.snapshot_delta(now, snapshots), on="station_id", how="left")
    for col in ("delta_30m", "delta_60m"):
        rows[col] = rows[col].astype("float64")  # 학습 dtype(float)과 맞춤 — NaN 없을 때 int로 굳는 것 방지

    # LightGBM은 학습 때 저장한 카테고리 목록으로 코드를 재매핑한다 — dtype만 category면 된다
    rows["station_id"] = rows["station_id"].astype("category")
    rows["holiday_type"] = pd.Categorical(rows["holiday_type"].astype(str), categories=list(config.HOLIDAY_TYPES))
    return rows


def current_bikes(snapshots: pd.DataFrame, now: pd.Timestamp) -> pd.Series:
    """s = now 직전 스냅샷의 bikes (index: station_id)."""
    snaps = snapshots[snapshots["snapshot_time"] <= now].sort_values("snapshot_time")
    return snaps.groupby("station_id", sort=False)["bikes"].last()


def predict_rates(art: Artifacts, rows: pd.DataFrame) -> pd.DataFrame:
    """버킷별 15분당 λ̂·μ̂ — FEATURE_COLUMNS 순서 고정 (train.feature_matrix와 동일)."""
    X = rows[list(config.FEATURE_COLUMNS)]
    out = rows[["station_id", "bucket_start"]].copy()
    out["station_id"] = out["station_id"].astype(str)
    out["lambda_hat"] = np.clip(art.lambda_model.predict(X), 0.0, None)
    out["mu_hat"] = np.clip(art.mu_model.predict(X), 0.0, None)
    return out


def compute_predictions(now: pd.Timestamp, rates: pd.DataFrame, s_by_station: pd.Series,
                        tail_correction: float = 1.0) -> pd.DataFrame:
    """대여소 × 지평 → [station_id, horizon_min, bikes, prob_out]. 표시용 클립·반올림은 여기서.

    probability.predict_horizons(대여소 1곳)와 같은 계산을 전 대여소 배열로 한 번에 한다 —
    버킷 가중치는 now·h에만 의존해 모든 대여소에 공통 (per-station 루프는 1,500곳에 3초).
    """
    wide = rates.pivot(index="station_id", columns="bucket_start", values=["lambda_hat", "mu_hat"])
    s = s_by_station.reindex(wide.index)
    keep = s.notna().to_numpy()
    wide, s = wide[keep], s[keep].to_numpy(dtype=float)

    frames = []
    for h in config.HORIZONS_MIN:
        lam_total = np.zeros(len(wide))
        mu_total = np.zeros(len(wide))
        for bucket, weight in probability.bucket_weights(now, h):
            if ("lambda_hat", bucket) not in wide.columns:
                raise KeyError(f"버킷 {bucket} 의 예측 율이 없음 — 대여소당 피처 행 구성(현재+다음) 확인")
            lam_total += wide[("lambda_hat", bucket)].to_numpy() * weight
            mu_total += wide[("mu_hat", bucket)].to_numpy() * weight
        frames.append(pd.DataFrame({
            "station_id": wide.index.to_numpy(),
            "horizon_min": h,
            "bikes": np.round(np.clip(probability.expected_bikes(s, lam_total, mu_total), 0.0, None), 1),
            "prob_out": np.round(probability.depletion_probability(s, lam_total, mu_total, tail_correction), 3),
        }))
    return pd.concat(frames, ignore_index=True)


def write_redis(client, preds: pd.DataFrame, now: pd.Timestamp) -> int:
    updated_at = now.floor("s").isoformat()
    pipe = client.pipeline(transaction=False)
    for station_id, h, bikes, prob_out in preds[["station_id", "horizon_min", "bikes", "prob_out"]].itertuples(index=False):
        key = config.REDIS_KEY_PATTERN.format(station_id=station_id, horizon_min=int(h))
        value = json.dumps({"bikes": float(bikes), "prob_out": float(prob_out), "updated_at": updated_at})
        pipe.set(key, value, ex=config.REDIS_TTL_SECONDS)
    pipe.execute()
    return len(preds)


# ── 1회 실행 · 루프 ──────────────────────────────────────────────────────

def run_once(art: Artifacts, conn, redis_client, now: pd.Timestamp | None = None) -> dict:
    now = now if now is not None else pd.Timestamp.now(tz=config.TZ)
    t0 = time.monotonic()
    snapshots = fetch_snapshots(conn, now)
    weather = fetch_weather(conn, now)
    blockers, warnings = readiness(snapshots, weather, now, art.known_stations)
    for w in warnings:
        log.warning(w)
    if blockers:
        for b in blockers:
            log.warning("미가동 — %s", b)
        return {"written": 0, "stations": 0, "blockers": blockers, "elapsed": time.monotonic() - t0}

    rows = build_feature_rows(now, snapshots, art.profile, weather)
    rates = predict_rates(art, rows)
    preds = compute_predictions(now, rates, current_bikes(snapshots, now))
    written = write_redis(redis_client, preds, now)
    elapsed = time.monotonic() - t0
    stations = len(rows) // 2
    log.info("적재 %d키 (%d대여소 × %d지평) %.2fs", written, stations, len(config.HORIZONS_MIN), elapsed)
    if elapsed > config.SERVE_TIME_BUDGET_SECONDS:
        log.warning("소요 %.2fs > 완료 기준 %ds", elapsed, config.SERVE_TIME_BUDGET_SECONDS)
    return {"written": written, "stations": stations, "blockers": [], "elapsed": elapsed}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="타슈 AI 서빙 배치 (매분 → Redis)")
    parser.add_argument("--once", action="store_true", help="1회 실행 후 종료 (기본: 60초 주기 루프)")
    parser.add_argument("--env-file", default=None, help="접속 환경변수 파일 (로컬: dev/.env)")
    args = parser.parse_args(argv)
    if args.env_file:
        load_env_file(args.env_file)

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                        format="%(asctime)s %(levelname)s %(message)s")

    art = load_artifacts()
    log.info("모델 로드: %s (대여소 %d곳 profile)", config.MODELS_DIR, len(art.known_stations))
    conn = db_connect()
    redis_client = redis_connect()

    while True:
        started = time.monotonic()
        try:
            try:
                conn.ping()
            except Exception:
                log.warning("MySQL 재연결")
                conn = db_connect()
            run_once(art, conn, redis_client)
        except Exception:
            log.exception("배치 실패 — 다음 주기에 재시도")
        if args.once:
            return
        time.sleep(max(0.0, config.SERVE_INTERVAL_SECONDS - (time.monotonic() - started)))


if __name__ == "__main__":
    main()
