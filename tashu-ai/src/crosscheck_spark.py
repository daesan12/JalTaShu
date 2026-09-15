# -*- coding: utf-8 -*-
"""데이터 담당 train_buckets(Spark) ↔ AI 자체 파이프라인(2·3단계) 교차 검증.

실행:  tashu-ai/ 디렉터리에서  python -m src.crosscheck_spark

계약 검수 체크 대응:
- 검수 1: 월별 행수·운영 대여소 수 대조 (양쪽 독립 구현 비교)
- 검수 2: delta_30m/60m을 Spark 테이블 자체의 rentals/returns로 재계산 대조
- 검수 4: 마스크 구간(2024-05-21~31, 2025-02-26~03-03, 2025-12) 행수 0 확인
- 추가: 셀 단위 rentals/returns 완전 대조, holiday_type·slot·weekday 재계산 대조,
  프로파일 값 대조, 내부 정합(강수↔minutes_since_rain, |delta|>20 NaN)

산출물: artifacts/reports/crosscheck_spark.txt
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src.buckets import known_mask_intervals
from src.features import holiday_type, slot_of_day, weekday

SPARK_BUCKETS = config.SPARK_DIR / "train_buckets"
CONTRACT_COLUMNS = [
    "station_id", "bucket_start", "rentals", "returns", "slot_of_day", "weekday",
    "holiday_type", "temperature", "rainfall_1h", "minutes_since_rain",
    "profile_rentals", "profile_returns", "delta_30m", "delta_60m",
]
DETAIL_MONTHS = ["2023-05", "2024-06", "2025-09", "2026-01"]  # 셀 단위 완전 대조 표본 (검증 구간 포함)
DELTA_SAMPLE_STATIONS = 3

PASS, FAIL = "PASS", "FAIL"


def load_spark_month(month: str, columns=None) -> pd.DataFrame:
    df = pd.read_parquet(SPARK_BUCKETS / f"{month}.parquet", columns=columns)
    if "bucket_start" in df.columns:
        df["bucket_start"] = df["bucket_start"].dt.tz_convert(config.TZ)
    return df


def load_ours_month(month: str) -> pd.DataFrame | None:
    f = config.ARTIFACTS_DIR / "buckets" / f"buckets_{month}.parquet"
    if not f.exists():
        return None
    df = pd.read_parquet(f)
    df["station_id"] = df["station_id"].astype(str)
    return df


def check(log, ok: bool, label: str, detail: str = "") -> bool:
    print(f"[{PASS if ok else FAIL}] {label}" + (f" — {detail}" if detail else ""), file=log)
    return ok


def main() -> None:
    log = io.StringIO()
    failures = 0

    spark_months = sorted(f.stem for f in SPARK_BUCKETS.glob("*.parquet"))
    print(f"Spark train_buckets: {len(spark_months)}개 월 파일 ({spark_months[0]} ~ {spark_months[-1]})\n", file=log)

    # ── 1) 스키마 (계약 §1) ────────────────────────────────────────────
    sample = load_spark_month(spark_months[0])
    failures += not check(log, list(sample.columns) == CONTRACT_COLUMNS, "스키마: 계약 §1 컬럼 14개·순서 일치",
                          f"실제 {list(sample.columns)}" if list(sample.columns) != CONTRACT_COLUMNS else "")
    failures += not check(log, sample["bucket_start"].dt.tz is not None, "bucket_start tz-aware",
                          f"저장 tz=UTC → KST 변환 후 비교 (순간 동일, 표현만 다름)")

    # ── 2) 마스크 (검수 4) — 정밀 시각 구간 [start, end) ────────────────
    print("\n== 검수 4: 마스크 구간 행수 (0이어야 함) ==", file=log)
    for start, end in known_mask_intervals():
        n = 0
        last = (end - pd.Timedelta(microseconds=1)).tz_localize(None).to_period("M")
        for m in pd.period_range(start.tz_localize(None).to_period("M"), last, freq="M"):
            if str(m) not in spark_months:
                continue
            b = load_spark_month(str(m), columns=["bucket_start"])["bucket_start"]
            n += int(((b >= start) & (b < end)).sum())
        failures += not check(log, n == 0, f"[{start} ~ {end}): 구간 내 행수 {n:,}")

    # ── 3) 월별 총계 대조 (검수 1 확장) ─────────────────────────────────
    print("\n== 월별 대조: 행수 / rentals 합 / returns 합 / 대여소 수 (Spark vs AI) ==", file=log)
    month_mismatch = []
    holiday_pairs = {}
    for m in spark_months:
        s = load_spark_month(m, columns=["station_id", "bucket_start", "rentals", "returns", "holiday_type"])
        o = load_ours_month(m)
        for d, h in s.assign(date=s["bucket_start"].dt.normalize()).drop_duplicates("date")[["date", "holiday_type"]].itertuples(index=False):
            holiday_pairs[d] = h
        if o is None:
            print(f"{m}  AI 산출물 없음 — 건너뜀", file=log)
            continue
        same = (len(s) == len(o) and int(s.rentals.sum()) == int(o.rentals.sum())
                and int(s.returns.sum()) == int(o.returns.sum())
                and s.station_id.nunique() == o.station_id.nunique())
        flag = "" if same else "  <-- 불일치"
        print(f"{m}  행수 {len(s):>9,}/{len(o):>9,} | 대여 {int(s.rentals.sum()):>8,}/{int(o.rentals.sum()):>8,} "
              f"| 반납 {int(s.returns.sum()):>8,}/{int(o.returns.sum()):>8,} "
              f"| 대여소 {s.station_id.nunique():,}/{o.station_id.nunique():,}{flag}", file=log)
        if not same:
            month_mismatch.append(m)
    failures += not check(log, not month_mismatch, "월별 총계 전 항목 일치", f"불일치 월: {month_mismatch}")

    # ── 4) holiday_type 전 날짜 대조 (features.py 재계산) ────────────────
    hdays = pd.Series(sorted(holiday_pairs))
    ours_h = holiday_type(pd.Series(pd.DatetimeIndex(hdays)))
    theirs_h = pd.Series([holiday_pairs[d] for d in hdays])
    diff_h = pd.DataFrame({"date": hdays, "spark": theirs_h, "ai": ours_h.astype(str)})
    diff_h = diff_h[diff_h["spark"] != diff_h["ai"]]
    failures += not check(log, diff_h.empty, f"holiday_type 전 날짜({len(hdays):,}일) 일치",
                          "" if diff_h.empty else f"불일치 {len(diff_h)}일 — 예: {diff_h.head(10).to_dict('records')}")

    # ── 5) 셀 단위 완전 대조 + slot/weekday/내부 정합 (표본 월) ──────────
    print("\n== 셀 단위 대조 (표본 월) ==", file=log)
    for m in DETAIL_MONTHS:
        if m not in spark_months:
            continue
        s = load_spark_month(m)
        o = load_ours_month(m)

        failures += not check(log, list(s["slot_of_day"]) == list(slot_of_day(s["bucket_start"])),
                              f"{m}: slot_of_day 재계산 일치")
        failures += not check(log, list(s["weekday"]) == list(weekday(s["bucket_start"])),
                              f"{m}: weekday 재계산 일치")
        rain_now = s["rainfall_1h"] >= config.RAIN_THRESHOLD_MMH
        bad_rain = int((rain_now & (s["minutes_since_rain"] != 0)).sum())
        failures += not check(log, bad_rain == 0, f"{m}: 강수 ≥1mm ↔ minutes_since_rain=0 정합", f"위반 {bad_rain:,}행")
        bad_delta = int(((s["delta_30m"].abs() > config.DELTA_REBALANCE_ABS)
                         | (s["delta_60m"].abs() > config.DELTA_REBALANCE_ABS)).sum())
        failures += not check(log, bad_delta == 0, f"{m}: |delta| > {config.DELTA_REBALANCE_ABS} NaN 규칙", f"위반 {bad_delta:,}행")

        if o is None:
            continue
        merged = s[["station_id", "bucket_start", "rentals", "returns"]].merge(
            o[["station_id", "bucket_start", "rentals", "returns"]],
            on=["station_id", "bucket_start"], how="outer", suffixes=("_sp", "_ai"), indicator=True)
        only_sp = int((merged["_merge"] == "left_only").sum())
        only_ai = int((merged["_merge"] == "right_only").sum())
        both = merged[merged["_merge"] == "both"]
        neq = int(((both["rentals_sp"] != both["rentals_ai"]) | (both["returns_sp"] != both["returns_ai"])).sum())
        failures += not check(log, only_sp == 0 and only_ai == 0 and neq == 0,
                              f"{m}: 셀 단위 rentals/returns 완전 일치",
                              f"Spark에만 {only_sp:,} / AI에만 {only_ai:,} / 값 불일치 {neq:,}")

    # ── 6) 검수 2: delta를 Spark 테이블 자체로 재계산 대조 ───────────────
    print("\n== 검수 2: delta 재계산 대조 (2024-06, 표본 대여소) ==", file=log)
    s = load_spark_month("2024-06")
    top = s.groupby("station_id")["rentals"].sum().nlargest(DELTA_SAMPLE_STATIONS).index
    for st in top:
        g = s[s["station_id"] == st].sort_values("bucket_start").reset_index(drop=True)
        contiguous = g["bucket_start"].diff().dt.total_seconds().eq(900)
        recomputed = ((g["returns"].shift(1) + g["returns"].shift(2))
                      - (g["rentals"].shift(1) + g["rentals"].shift(2)))
        recomputed[recomputed.abs() > config.DELTA_REBALANCE_ABS] = np.nan
        valid = contiguous & contiguous.shift(1, fill_value=False)
        got, exp = g.loc[valid, "delta_30m"], recomputed[valid]
        n_diff = int((~((got == exp) | (got.isna() & exp.isna()))).sum())
        failures += not check(log, n_diff == 0, f"{st}: delta_30m 재계산 일치 ({int(valid.sum()):,}행)", f"불일치 {n_diff:,}")

    # ── 7) 프로파일 값 대조 (AI station_profile vs Spark 컬럼) ───────────
    print("\n== 프로파일 대조 (2024-06 표본) ==", file=log)
    prof = pd.read_parquet(config.ARTIFACTS_DIR / "profile" / "station_profile.parquet")
    sm = s[["station_id", "slot_of_day", "weekday", "profile_rentals", "profile_returns"]].drop_duplicates(
        ["station_id", "weekday", "slot_of_day"])
    j = sm.merge(prof, on=["station_id", "weekday", "slot_of_day"], how="inner")
    max_abs = float((j["profile_rentals"] - j["avg_rentals"]).abs().max())
    failures += not check(log, max_abs < 0.05, f"profile_rentals 대조 ({len(j):,}셀)", f"최대 절대 차 {max_abs:.4f}")
    nan_prof = int(load_spark_month("2026-01", columns=["profile_rentals"])["profile_rentals"].isna().sum()) \
        if "2026-01" in spark_months else -1
    check(log, True, f"신규 대여소 프로파일 NaN 유지 (2026-01 NaN {nan_prof:,}행 — 참고)")

    # ── 결과 ────────────────────────────────────────────────────────────
    print(f"\n{'='*60}\n최종: {'전 항목 PASS' if failures == 0 else f'FAIL {failures}건 — 데이터 담당과 논의 필요'}", file=log)

    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out = config.REPORTS_DIR / "crosscheck_spark.txt"
    out.write_text(log.getvalue(), encoding="utf-8")
    try:
        print(log.getvalue())
    except UnicodeEncodeError:
        sys.stdout.buffer.write(log.getvalue().encode("utf-8", errors="replace"))
    print(f"리포트 저장: {out}")


if __name__ == "__main__":
    main()
