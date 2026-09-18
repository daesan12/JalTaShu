# -*- coding: utf-8 -*-
"""9·10단계 공용: 스냅샷 리플레이 — 시점 t마다 서빙과 같은 코드로 예측하고 t+h 실제와 짝짓는다.

누출 방지: t 시점 입력은 t 이전 스냅샷(features.snapshot_delta가 과거 방향만 매칭)과 t 이전 관측만.
실제값은 t+h 직전(±3분 허용) 스냅샷의 bikes. 스냅샷은 홀드아웃 — 학습에 쓰지 않는다.

산출 테이블 (Parquet, config.REPLAY_DIR):
  t, station_id, horizon_min, s, lam_total, mu_total, prob_model, bikes_pred,
  prob_bl_profile(프로파일 평균 율의 포아송 꼬리), prob_bl_current(s ≤ 0이면 1, 아니면 0),
  has_profile, has_delta, bikes_actual, depleted
실행: python -m src.replay --start 2026-09-10 --end 2026-09-17 [--step 5]
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src import probability, serve, snapshots

log = logging.getLogger("tashu.replay")


def time_window(snaps: pd.DataFrame, lo: pd.Timestamp, hi: pd.Timestamp,
                time_index: pd.DatetimeIndex | None = None) -> pd.DataFrame:
    """snapshot_time ∈ (lo, hi] 행. time_index(snapshot_time 오름차순, snaps 위치와 일치)가 있으면 이진탐색 슬라이스.

    8일치 스냅샷은 2,100만 행 — 시점마다 불리언 마스크·재정렬을 하면 시점당 9.5초(6시간)라서, replay_range가
    한 번 정렬한 표와 그 DatetimeIndex를 넘긴다. time_index가 없으면(단위 테스트·단발 호출) 마스크로 같은 결과.
    """
    if time_index is None:
        return snaps[(snaps["snapshot_time"] > lo) & (snaps["snapshot_time"] <= hi)]
    i = time_index.searchsorted(lo, side="right")
    j = time_index.searchsorted(hi, side="right")
    return snaps.iloc[i:j]


def actual_bikes_at(snaps: pd.DataFrame, target: pd.Timestamp, stations: pd.Index) -> pd.Series:
    """target 직전(±허용 오차) 스냅샷의 bikes — 없으면 NaN (서빙 delta와 같은 backward 매칭)."""
    left = pd.DataFrame({"station_id": stations, "_t": target})
    matched = pd.merge_asof(
        left, snaps.sort_values("snapshot_time")[["station_id", "snapshot_time", "bikes"]],
        left_on="_t", right_on="snapshot_time", by="station_id", direction="backward",
        tolerance=pd.Timedelta(minutes=config.SNAPSHOT_MATCH_TOLERANCE_MIN),
    )
    return pd.Series(matched["bikes"].to_numpy(dtype=float), index=stations)


def replay_at(t: pd.Timestamp, snaps: pd.DataFrame, weather: pd.DataFrame, art: serve.Artifacts,
              horizons_min: tuple[int, ...] = config.EVAL_HORIZONS_MIN,
              time_index: pd.DatetimeIndex | None = None) -> pd.DataFrame | None:
    """시점 t 하나의 예측·베이스라인·실제. 입력 부족(가동 점검 차단)이면 None."""
    window = time_window(snaps, t - pd.Timedelta(minutes=config.SNAPSHOT_HISTORY_MIN), t, time_index)
    w_past = weather[weather["obs_time"] <= t]
    blockers, _ = serve.readiness(window, w_past, t, art.known_stations)
    if blockers:
        return None

    rows = serve.build_feature_rows(t, window, art.profile, w_past)
    rates = serve.predict_rates(art, rows)
    # 베이스라인 1: 프로파일 평균 율(15분당)을 같은 포아송 꼬리에 넣는다 (설계서 §5 베이스라인①)
    rates["profile_rentals"] = rows["profile_rentals"].to_numpy(dtype=float)
    rates["profile_returns"] = rows["profile_returns"].to_numpy(dtype=float)
    s_now = serve.current_bikes(window, t)

    model = serve.horizon_totals(t, rates, s_now, horizons_min)
    prof = serve.horizon_totals(t, rates, s_now, horizons_min, rate_cols=("profile_rentals", "profile_returns"))
    s, lam, mu = model["s"].to_numpy(), model["lam_total"].to_numpy(), model["mu_total"].to_numpy()
    out = pd.DataFrame({
        "t": t,
        "station_id": model["station_id"].to_numpy(),
        "horizon_min": model["horizon_min"].to_numpy(),
        "s": s, "lam_total": lam, "mu_total": mu,
        # 서빙(serve.compute_predictions)과 같은 보정계수. 베이스라인에도 같은 값 — 과산포는 수요 과정의 성질이라
        # 모델 고유가 아니고, 모델만 보정하면 비교가 불공정하다. calibrate의 격자 탐색은 원시 λ·μ·s로 다시 계산한다.
        "prob_model": probability.depletion_probability(s, lam, mu, tail_correction=config.TAIL_CORRECTION),
        "bikes_pred": np.clip(probability.expected_bikes(s, lam, mu), 0.0, None),
    })
    prof_lam, prof_mu = prof["lam_total"].to_numpy(), prof["mu_total"].to_numpy()
    prof_known = ~(np.isnan(prof_lam) | np.isnan(prof_mu))
    out["prob_bl_profile"] = np.where(
        prof_known,
        probability.depletion_probability(s, np.nan_to_num(prof_lam), np.nan_to_num(prof_mu), tail_correction=config.TAIL_CORRECTION),
        np.nan,
    )
    out["prob_bl_current"] = (s <= config.DEPLETION_BIKES).astype(float)
    out["has_profile"] = prof_known
    delta_ok = rows.groupby("station_id", observed=True)["delta_30m"].first().notna()
    out["has_delta"] = out["station_id"].map(delta_ok).fillna(False).to_numpy()

    actual = pd.Series(np.nan, index=out.index)
    for h in horizons_min:
        mask = out["horizon_min"] == h
        st = pd.Index(out.loc[mask, "station_id"])
        target = t + pd.Timedelta(minutes=h)
        near = time_window(snaps, target - pd.Timedelta(minutes=config.SNAPSHOT_MATCH_TOLERANCE_MIN, seconds=1), target, time_index)
        actual[mask] = actual_bikes_at(near, target, st).to_numpy()
    out["bikes_actual"] = actual
    out["depleted"] = np.where(actual.isna(), np.nan, (actual <= config.DEPLETION_BIKES).astype(float))
    return out


def replay_range(start: pd.Timestamp, end: pd.Timestamp, step_min: int, art: serve.Artifacts,
                 snaps: pd.DataFrame, weather: pd.DataFrame,
                 horizons_min: tuple[int, ...] = config.EVAL_HORIZONS_MIN) -> pd.DataFrame:
    times = pd.date_range(start, end, freq=f"{step_min}min").as_unit(snapshots.TIME_UNIT)
    snaps = snaps.sort_values("snapshot_time", kind="stable").reset_index(drop=True)
    time_index = pd.DatetimeIndex(snaps["snapshot_time"])
    frames, skipped = [], 0
    t0 = time.monotonic()
    for i, t in enumerate(times):
        part = replay_at(t, snaps, weather, art, horizons_min, time_index=time_index)
        if part is None:
            skipped += 1
        else:
            frames.append(part)
        if (i + 1) % 100 == 0:
            log.info("%d/%d 시점 (%.0fs, 차단 %d)", i + 1, len(times), time.monotonic() - t0, skipped)
    log.info("리플레이 완료: 시점 %d, 차단 %d, %.0fs", len(times), skipped, time.monotonic() - t0)
    if not frames:
        return pd.DataFrame()
    out = pd.concat(frames, ignore_index=True)
    return out[out["depleted"].notna()].reset_index(drop=True)  # 실제값 없는 행(꼬리·공백)은 평가 불가


def output_path(start: pd.Timestamp, end: pd.Timestamp) -> Path:
    return config.REPLAY_DIR / f"replay_{start:%Y%m%d}_{end:%Y%m%d}.parquet"


def stations_path(start: pd.Timestamp, end: pd.Timestamp) -> Path:
    return config.REPLAY_DIR / f"stations_{start:%Y%m%d}_{end:%Y%m%d}.parquet"


def station_table(snaps: pd.DataFrame) -> pd.DataFrame:
    """대여소 좌표 (마지막 스냅샷 기준) — 백테스트 후보 거리 계산용."""
    last = snaps.sort_values("snapshot_time").groupby("station_id", sort=True)[["lat", "lon"]].last()
    return last.reset_index()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="스냅샷 리플레이 — 예측 vs 실제 테이블 생성")
    parser.add_argument("--start", required=True, help="KST 날짜, 예 2026-09-10 (00:00부터)")
    parser.add_argument("--end", required=True, help="KST 날짜, 예 2026-09-17 (그날 00:00 직전까지)")
    parser.add_argument("--step", type=int, default=config.REPLAY_STEP_MIN, help="평가 시점 간격(분)")
    parser.add_argument("--no-backfill", action="store_true", help="Open-Meteo 날씨 채우기 사용 안 함 (기상청만)")
    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    logging.basicConfig(level=logging.INFO, stream=sys.stdout, format="%(asctime)s %(levelname)s %(message)s")

    start = pd.Timestamp(args.start, tz=config.TZ)
    end = pd.Timestamp(args.end, tz=config.TZ) - pd.Timedelta(minutes=1)
    pad_before = pd.Timedelta(minutes=config.SNAPSHOT_HISTORY_MIN)
    pad_after = pd.Timedelta(minutes=max(config.EVAL_HORIZONS_MIN) + config.SNAPSHOT_MATCH_TOLERANCE_MIN)
    snaps = snapshots.load_snapshots(start - pad_before, end + pad_after)
    w_start = start - pd.Timedelta(hours=config.WEATHER_HISTORY_HOURS + 2)
    weather = snapshots.load_weather(w_start, end)
    if not args.no_backfill and config.WEATHER_BACKFILL_DIR.exists():
        backfill = snapshots.load_weather(w_start, end, root=config.WEATHER_BACKFILL_DIR)
        weather, source_summary = snapshots.merge_weather(weather, backfill)
        log.info("날씨 소스 병합 (기상청 우선, 공백은 Open-Meteo):\n%s", source_summary.to_string(index=False))
    log.info("스냅샷 %s행 / 날씨 %d행 (강수≥1mm/h %d시간)", f"{len(snaps):,}", len(weather),
             int((weather["rainfall_1h"] >= config.RAIN_THRESHOLD_MMH).sum()) if len(weather) else 0)
    cov = snapshots.coverage(snaps)
    log.info("수집 커버리지:\n%s", cov.to_string())

    art = serve.load_artifacts()
    table = replay_range(start, end, args.step, art, snaps, weather)
    config.REPLAY_DIR.mkdir(parents=True, exist_ok=True)
    path = output_path(start, end)
    table.to_parquet(path, index=False)
    station_table(snaps).to_parquet(stations_path(start, end), index=False)
    cov.to_csv(config.REPLAY_DIR / f"coverage_{start:%Y%m%d}_{end:%Y%m%d}.csv", encoding="utf-8-sig")
    log.info("저장: %s (%s행, 고갈 %s건)", path, f"{len(table):,}", f"{int(table['depleted'].sum()):,}")


if __name__ == "__main__":
    main()
