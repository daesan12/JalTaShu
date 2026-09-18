# -*- coding: utf-8 -*-
"""10단계: 백테스트 — "추천을 따랐다면 헛걸음이 N% 줄었다" (설계서 §6-3, 발표 핵심 수치).

리플레이 테이블(시점 t의 예측 + t+h 실제)을 여정 선택 시뮬레이션에 넣는다.
- 출발 위치: 각 대여소 위치에 사용자가 서 있다고 가정. 후보 = 반경 안 가까운 K곳(자기 포함).
- 도보 시간 = 거리 / 속도 → 평가 지평 h_eval = {5,10,15} 중 도보분 이상인 최소값(올림, 보수적).
- 정책 A (베이스라인, 현재 잔여 기준): 지금 자전거가 있는(s ≥ 1) 가장 가까운 후보. 없으면 가장 가까운 곳.
- 정책 B (AI 추천): 기대 이동비용 = 도보분 + prob_out(h_eval) × 실패 벌점(분) 이 최소인 후보.
- 결과: 도착 시점 실제 잔여 ≤ 0 이면 헛걸음. 두 정책의 헛걸음율·평균 도보시간 비교.
평가 대상은 "A가 고를 수 있는 후보가 하나라도 있던 상황"(s ≥ 1 후보 존재)으로 한정한다.
산출: backtest_summary_<기간>.csv · backtest_by_hour_<기간>.csv · backtest_report_<기간>.txt
실행: python -m src.backtest --start 2026-09-10 --end 2026-09-17
"""
from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src import replay


def haversine_m(lat1, lon1, lat2, lon2) -> np.ndarray:
    r = 6_371_000.0
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = p2 - p1
    dlmb = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlmb / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(a))


def eval_horizon(walk_min: np.ndarray, horizons: tuple[int, ...] = config.EVAL_HORIZONS_MIN) -> np.ndarray:
    """도보분 이상인 최소 평가 지평 (올림). 최대 지평 초과는 최대 지평으로 (후보 반경이 이를 막는다)."""
    hs = np.array(sorted(horizons), dtype=float)
    idx = np.searchsorted(hs, np.maximum(walk_min, hs[0]), side="left")
    return hs[np.clip(idx, 0, len(hs) - 1)]


def candidate_table(stations: pd.DataFrame, k: int = config.BACKTEST_K_NEAREST,
                    max_walk_m: float = config.BACKTEST_MAX_WALK_M,
                    speed_mpm: float = config.BACKTEST_WALK_SPEED_MPM) -> pd.DataFrame:
    """출발 대여소 × 후보 대여소 (거리·도보분·평가 지평). 자기 자신은 거리 0."""
    ids = stations["station_id"].to_numpy()
    lat, lon = stations["lat"].to_numpy(dtype=float), stations["lon"].to_numpy(dtype=float)
    rows = []
    for i in range(len(ids)):
        d = haversine_m(lat[i], lon[i], lat, lon)
        order = np.argsort(d)[:k]
        for j in order:
            if d[j] <= max_walk_m:
                rows.append((ids[i], ids[j], float(d[j])))
    cand = pd.DataFrame(rows, columns=["origin", "station_id", "dist_m"])
    cand["walk_min"] = np.maximum(1.0, np.ceil(cand["dist_m"] / speed_mpm))
    cand["horizon_min"] = eval_horizon(cand["walk_min"].to_numpy()).astype(int)
    return cand


def simulate(table: pd.DataFrame, cand: pd.DataFrame,
             fail_penalty_min: float = config.BACKTEST_FAIL_PENALTY_MIN) -> pd.DataFrame:
    """시점 × 출발지마다 정책 A·B의 선택과 결과. 반환: t, origin, chosen_a, chosen_b, walk_a, walk_b, miss_a, miss_b, prob_b.

    두 정책의 선택지는 같다 — 현재 잔여 ≥1인 후보. A는 그중 최근접, B는 그중 기대비용(도보 + 고갈확률 × 벌점) 최소.
    (s=0 후보를 B에 허용하면 도보 1분·확률 1인 빈 출발지의 비용 9분이 8분 넘게 떨어진 잔여 대여소를 이겨 빈 곳을
    추천하게 된다 — 1일 스모크에서 결정의 0.8%였지만 그 98%가 헛걸음. 앱 추천 후보도 잔여 있는 곳이므로 제외.)
    """
    pred = table[["t", "station_id", "horizon_min", "s", "prob_model", "depleted"]]
    joined = cand.merge(pred, on=["station_id", "horizon_min"], how="inner")
    joined["cost_b"] = joined["walk_min"] + joined["prob_model"] * fail_penalty_min
    joined["has_bike_now"] = joined["s"] >= 1

    # 벡터화: 잔여 있는 후보만 남기고 거리순으로 한 번 정렬 → 그룹별 첫 행(A)·비용 최소 행(B). 정렬 뒤 idxmin은
    # 동률이면 거리가 짧은 쪽을 고르므로 그룹 루프(sort_values → iloc[0] / idxmin)와 결과가 같다. 8일치 320만 그룹을
    # 파이썬 루프로 돌면 50분, 벡터화하면 1분 이내.
    g = joined[joined["has_bike_now"]].sort_values("dist_m", kind="stable")
    if g.empty:
        return pd.DataFrame(columns=["t", "origin", "chosen_a", "chosen_b", "walk_a", "walk_b", "miss_a", "miss_b", "prob_b"])
    grp = g.groupby(["t", "origin"], sort=False)
    a = g.loc[grp["dist_m"].idxmin()].set_index(["t", "origin"])   # 잔여 있는 후보가 없는 (t, origin)은 자연히 빠진다
    b = g.loc[grp["cost_b"].idxmin()].set_index(["t", "origin"])
    out = pd.DataFrame({
        "chosen_a": a["station_id"], "chosen_b": b["station_id"],
        "walk_a": a["walk_min"], "walk_b": b["walk_min"],
        "miss_a": a["depleted"].astype(float), "miss_b": b["depleted"].astype(float),
        "prob_b": b["prob_model"].astype(float),
    }).reset_index()
    return out[["t", "origin", "chosen_a", "chosen_b", "walk_a", "walk_b", "miss_a", "miss_b", "prob_b"]]


def summarize(decisions: pd.DataFrame) -> pd.DataFrame:
    n = len(decisions)
    miss_a, miss_b = decisions["miss_a"].mean(), decisions["miss_b"].mean()
    reduction = (miss_a - miss_b) / miss_a if miss_a > 0 else np.nan
    return pd.DataFrame([{
        "decisions": n,
        "miss_rate_current": miss_a, "miss_rate_ai": miss_b, "miss_reduction": reduction,
        "misses_current": int(decisions["miss_a"].sum()), "misses_ai": int(decisions["miss_b"].sum()),
        "avg_walk_current_min": decisions["walk_a"].mean(), "avg_walk_ai_min": decisions["walk_b"].mean(),
        "changed_choice_rate": (decisions["chosen_a"] != decisions["chosen_b"]).mean(),
        # 기대 총 이동시간 = 도보 + 헛걸음 × 벌점 (추천의 실질 이득)
        "expected_time_current_min": (decisions["walk_a"] + decisions["miss_a"] * config.BACKTEST_FAIL_PENALTY_MIN).mean(),
        "expected_time_ai_min": (decisions["walk_b"] + decisions["miss_b"] * config.BACKTEST_FAIL_PENALTY_MIN).mean(),
    }])


def by_hour(decisions: pd.DataFrame) -> pd.DataFrame:
    hour = pd.to_datetime(decisions["t"]).dt.tz_convert(config.TZ).dt.hour
    g = decisions.groupby(hour)
    out = pd.DataFrame({"decisions": g.size(), "miss_rate_current": g["miss_a"].mean(), "miss_rate_ai": g["miss_b"].mean()})
    out["miss_reduction"] = (out["miss_rate_current"] - out["miss_rate_ai"]) / out["miss_rate_current"]
    return out.rename_axis("hour").reset_index()


def write_report(decisions: pd.DataFrame, summary: pd.DataFrame, hourly: pd.DataFrame, log: io.TextIOBase) -> None:
    s = summary.iloc[0]
    t = pd.to_datetime(decisions["t"])
    print(f"기간 {t.min():%Y-%m-%d %H:%M} ~ {t.max():%Y-%m-%d %H:%M} KST | 시점 {t.nunique():,} | 결정 {int(s['decisions']):,}건", file=log)
    print(f"후보 K={config.BACKTEST_K_NEAREST}, 반경 {config.BACKTEST_MAX_WALK_M}m, 도보 {config.BACKTEST_WALK_SPEED_MPM}m/분, "
          f"헛걸음 벌점 {config.BACKTEST_FAIL_PENALTY_MIN}분", file=log)
    print(f"\n헛걸음율  현재잔여 기준 {s['miss_rate_current']:.2%} ({int(s['misses_current']):,}건)  →  "
          f"AI 추천 {s['miss_rate_ai']:.2%} ({int(s['misses_ai']):,}건)", file=log)
    print(f"**헛걸음 감소율 {s['miss_reduction']:.1%}**", file=log)
    print(f"평균 도보  현재잔여 {s['avg_walk_current_min']:.2f}분 → AI {s['avg_walk_ai_min']:.2f}분 "
          f"(추천이 선택을 바꾼 비율 {s['changed_choice_rate']:.1%})", file=log)
    print(f"기대 총 이동시간(도보+헛걸음 벌점)  {s['expected_time_current_min']:.2f}분 → {s['expected_time_ai_min']:.2f}분", file=log)
    print("\n[시간대별 헛걸음율]", file=log)
    print(hourly.round(4).to_string(index=False), file=log)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="백테스트 — 추천 vs 현재 잔여 기준 헛걸음 비교")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    start = pd.Timestamp(args.start, tz=config.TZ)
    end = pd.Timestamp(args.end, tz=config.TZ) - pd.Timedelta(minutes=1)
    table = pd.read_parquet(replay.output_path(start, end))
    stations = pd.read_parquet(replay.stations_path(start, end))

    decisions = simulate(table, candidate_table(stations))
    summary, hourly = summarize(decisions), by_hour(decisions)
    log = io.StringIO()
    write_report(decisions, summary, hourly, log)

    tag = f"{start:%Y%m%d}_{end:%Y%m%d}"
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    summary.to_csv(config.REPORTS_DIR / f"backtest_summary_{tag}.csv", index=False, encoding="utf-8-sig")
    hourly.to_csv(config.REPORTS_DIR / f"backtest_by_hour_{tag}.csv", index=False, encoding="utf-8-sig")
    decisions.to_parquet(config.REPLAY_DIR / f"decisions_{tag}.parquet", index=False)
    (config.REPORTS_DIR / f"backtest_report_{tag}.txt").write_text(log.getvalue(), encoding="utf-8")
    print(log.getvalue())


if __name__ == "__main__":
    main()
