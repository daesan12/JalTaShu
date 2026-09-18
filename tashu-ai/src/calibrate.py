# -*- coding: utf-8 -*-
"""9단계: 캘리브레이션 — 리플레이 테이블(예측 vs 실제)로 확률 품질을 재고 보정계수를 확정한다.

설계서 §5·§6: 확률 지표는 Brier · PR-AUC · 캘리브레이션 곡선 (accuracy 금지 — 고갈은 희귀 이벤트).
베이스라인 2종 병기: ① 프로파일 평균 율의 포아송 꼬리 ② 현재 잔여 휴리스틱(s ≤ 0 → 1).
보정: (a) tail_correction 스칼라 격자에서 Brier 최소 (probability.depletion_probability 파라미터)
      (b) isotonic 회귀 (sklearn) — 참고용 곡선, 서빙 적용 여부는 결과 보고 결정.
산출 (config.REPORTS_DIR): calibration_metrics_<기간>.csv · calibration_curve_<기간>.csv ·
      tail_correction_<기간>.csv · calibration_report_<기간>.txt
실행: python -m src.calibrate --start 2026-09-10 --end 2026-09-17
"""
from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import average_precision_score, brier_score_loss

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src import probability, replay

PROB_COLS = {"model": "prob_model", "bl_profile": "prob_bl_profile", "bl_current": "prob_bl_current"}


def _safe_ap(y: np.ndarray, p: np.ndarray) -> float:
    return float(average_precision_score(y, p)) if 0 < y.sum() < len(y) else float("nan")


def metrics_table(table: pd.DataFrame) -> pd.DataFrame:
    """지평 × (모델·베이스라인2종) Brier / PR-AUC / 표본·고갈 수. 프로파일 없는 신규 대여소는 분리 집계."""
    rows = []
    has_bike = table["s"] >= 1
    groups = [("all", table), ("has_profile", table[table["has_profile"]]), ("new_station", table[~table["has_profile"]]),
              # s=0 행은 세 예측자 모두 계약상 확률 1(이미 고갈)로 같아 비교 정보가 없다. 예측이 결정을 바꾸는 구간만 분리.
              ("has_bike_now", table[has_bike]), ("empty_now", table[~has_bike])]
    for group_name, g in groups:
        for h, gh in g.groupby("horizon_min"):
            y = gh["depleted"].to_numpy(dtype=float)
            base = {"group": group_name, "horizon_min": int(h), "n": len(gh), "n_depleted": int(y.sum()),
                    "depletion_rate": float(y.mean()) if len(y) else float("nan")}
            for name, col in PROB_COLS.items():
                p = gh[col].to_numpy(dtype=float)
                ok = ~np.isnan(p)
                if ok.sum() == 0:
                    rows.append({**base, "predictor": name, "brier": np.nan, "pr_auc": np.nan, "mean_pred": np.nan})
                    continue
                rows.append({**base, "predictor": name,
                             "brier": float(brier_score_loss(y[ok], np.clip(p[ok], 0, 1))),
                             "pr_auc": _safe_ap(y[ok], p[ok]),
                             "mean_pred": float(p[ok].mean())})
    return pd.DataFrame(rows)


def calibration_curve(table: pd.DataFrame, prob_col: str = "prob_model",
                      bins: int = config.CALIBRATION_BINS) -> pd.DataFrame:
    """지평별 확률 구간(등폭) → 평균 예측 확률 vs 실제 고갈률 · 표본 수. 실측/예측 비율 = 낙관 편향."""
    edges = np.linspace(0.0, 1.0, bins + 1)
    out = []
    for h, g in table.groupby("horizon_min"):
        p = g[prob_col].to_numpy(dtype=float)
        y = g["depleted"].to_numpy(dtype=float)
        idx = np.clip(np.digitize(p, edges[1:-1], right=False), 0, bins - 1)
        for b in range(bins):
            m = idx == b
            if m.sum() == 0:
                continue
            out.append({"horizon_min": int(h), "bin": b, "bin_lo": edges[b], "bin_hi": edges[b + 1],
                        "n": int(m.sum()), "mean_pred": float(p[m].mean()), "observed": float(y[m].mean()),
                        "observed_over_pred": float(y[m].mean() / p[m].mean()) if p[m].mean() > 0 else np.nan})
    return pd.DataFrame(out)


def tail_correction_search(table: pd.DataFrame,
                           grid: tuple[float, ...] = config.TAIL_CORRECTION_GRID) -> pd.DataFrame:
    """지평별로 보정계수 c ∈ grid 에 대해 Brier 재계산 → 최소 c. 확률은 원시 λ·μ·s에서 다시 계산."""
    out = []
    for h, g in table.groupby("horizon_min"):
        s, lam, mu = g["s"].to_numpy(), g["lam_total"].to_numpy(), g["mu_total"].to_numpy()
        y = g["depleted"].to_numpy(dtype=float)
        for c in grid:
            p = probability.depletion_probability(s, lam, mu, tail_correction=c)
            out.append({"horizon_min": int(h), "tail_correction": c,
                        "brier": float(brier_score_loss(y, np.clip(p, 0, 1))), "mean_pred": float(p.mean()),
                        "observed": float(y.mean())})
    df = pd.DataFrame(out)
    df["best"] = df.groupby("horizon_min")["brier"].transform("min") == df["brier"]
    return df


def fit_isotonic(table: pd.DataFrame, horizon_min: int) -> IsotonicRegression:
    g = table[table["horizon_min"] == horizon_min]
    iso = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip")
    iso.fit(g["prob_model"].to_numpy(dtype=float), g["depleted"].to_numpy(dtype=float))
    return iso


def period_tag(table: pd.DataFrame) -> str:
    t = pd.to_datetime(table["t"])
    return f"{t.min():%Y%m%d}_{t.max():%Y%m%d}"


def write_report(table: pd.DataFrame, metrics: pd.DataFrame, curve: pd.DataFrame, tail: pd.DataFrame,
                 log: io.TextIOBase) -> None:
    t = pd.to_datetime(table["t"])
    print(f"기간 {t.min():%Y-%m-%d %H:%M} ~ {t.max():%Y-%m-%d %H:%M} KST | 시점 {t.nunique():,} | "
          f"대여소 {table['station_id'].nunique():,} | 표본 {len(table):,} | 고갈 {int(table['depleted'].sum()):,}"
          f" ({table['depleted'].mean():.2%})", file=log)
    print(f"모델·프로파일 베이스라인 확률은 서빙과 같은 보정계수 {config.TAIL_CORRECTION} 적용 (config.TAIL_CORRECTION). "
          f"아래 [보정계수 탐색]은 원시 λ·μ·s에서 격자를 다시 계산한 값.", file=log)
    print("\n[지표 — 지평 × 예측자] (Brier 낮을수록 / PR-AUC 높을수록 좋음)", file=log)
    view = metrics[metrics["group"] == "all"].pivot(index="horizon_min", columns="predictor", values=["brier", "pr_auc"])
    print(view.round(4).to_string(), file=log)
    hb = table["s"] >= 1
    print(f"\n[결정 구간 — 현재 잔여 ≥1] 표본 {int(hb.sum()):,} ({hb.mean():.1%}) | 고갈 {int(table.loc[hb, 'depleted'].sum()):,}"
          f" ({table.loc[hb, 'depleted'].mean():.2%}) — s=0 행({(~hb).mean():.1%})은 예측자 셋 모두 확률 1로 같아 제외", file=log)
    view = metrics[metrics["group"] == "has_bike_now"].pivot(index="horizon_min", columns="predictor",
                                                             values=["brier", "pr_auc", "mean_pred"])
    print(view.round(4).to_string(), file=log)
    print("\n[콜드스타트 분리] 프로파일 보유 vs 신규 대여소 (모델 Brier)", file=log)
    cs = metrics[(metrics["predictor"] == "model") & (metrics["group"].isin(["has_profile", "new_station"]))]
    print(cs.pivot(index="horizon_min", columns="group", values=["n", "brier"]).round(4).to_string(), file=log)
    print("\n[캘리브레이션 곡선 — 15분] observed/pred > 1 이면 낙관 편향(실제가 예측보다 자주 고갈)", file=log)
    print(curve[curve["horizon_min"] == max(config.EVAL_HORIZONS_MIN)]
          .set_index("bin")[["bin_lo", "bin_hi", "n", "mean_pred", "observed", "observed_over_pred"]].round(3).to_string(), file=log)
    print("\n[보정계수 탐색] 지평별 Brier 최소 tail_correction", file=log)
    print(tail[tail["best"]][["horizon_min", "tail_correction", "brier", "mean_pred", "observed"]].round(4).to_string(index=False), file=log)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="캘리브레이션 — 리플레이 테이블 지표·보정계수")
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    start = pd.Timestamp(args.start, tz=config.TZ)
    end = pd.Timestamp(args.end, tz=config.TZ) - pd.Timedelta(minutes=1)
    path = replay.output_path(start, end)
    if not path.exists():
        raise FileNotFoundError(f"리플레이 테이블 없음: {path} — 먼저 python -m src.replay --start … --end …")
    table = pd.read_parquet(path)

    metrics = metrics_table(table)
    curve = calibration_curve(table)
    tail = tail_correction_search(table)
    log = io.StringIO()
    write_report(table, metrics, curve, tail, log)

    tag = period_tag(table)
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    metrics.to_csv(config.REPORTS_DIR / f"calibration_metrics_{tag}.csv", index=False, encoding="utf-8-sig")
    curve.to_csv(config.REPORTS_DIR / f"calibration_curve_{tag}.csv", index=False, encoding="utf-8-sig")
    tail.to_csv(config.REPORTS_DIR / f"tail_correction_{tag}.csv", index=False, encoding="utf-8-sig")
    (config.REPORTS_DIR / f"calibration_report_{tag}.txt").write_text(log.getvalue(), encoding="utf-8")
    print(log.getvalue())
    print(f"저장: {config.REPORTS_DIR / f'calibration_*_{tag}.*'}")


if __name__ == "__main__":
    main()
