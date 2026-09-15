# -*- coding: utf-8 -*-
"""2단계: trips Parquet → 15분 버킷 집계(rentals/returns) + 누락 마스크 + 운영 구간 0-fill.

실행:  tashu-ai/ 디렉터리에서  python -m src.buckets

계약 (docs/피처_스키마_계약.md §1·§3):
- 버킷 = 반개구간 [start, end), KST 정시 기준 floor(minute/15). 경계 08:15:00.000은 다음 버킷.
- 0-fill 순서: ① 마스크 구간(알려진 장애 + 도시 전체 '일 단위 0건' 날짜 자동 편입)은
  행 자체를 생성하지 않는다 → ② 남은 구간에서 운영 중이던 대여소만 0-fill.
- 운영 구간 = 대여·반납 통틀어 [첫 등장일, 마지막 등장일]. 구간 밖 행 생성 금지
  (관측 없음 ≠ 수요 0). 구간 안의 긴 0건 공백은 정상 패턴으로 0 유지.
- 0-fill의 0은 결측 대체가 아니라 "운영 중 무수요"의 실측 라벨이다 (계약이 요구).

산출물:
- artifacts/buckets/buckets_YYYY-MM.parquet  (station_id, bucket_start, rentals, returns)
- artifacts/reports/buckets_report.txt
"""
from __future__ import annotations

import io
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config


# ── 순수 함수 (단위 테스트 대상) ─────────────────────────────────────────

def bucket_floor(ts: pd.Series) -> pd.Series:
    """계약 §3: floor(minute/15). 반올림·ceil 금지."""
    return ts.dt.floor(f"{config.BUCKET_MINUTES}min")


def station_windows(events: pd.DataFrame) -> pd.DataFrame:
    """운영 구간: 대여·반납 통틀어 station별 [첫 등장일, 마지막 등장일] (KST 일 단위).

    events: columns [ts, station_id] — 대여 이벤트와 반납 이벤트를 합친 프레임.
    """
    day = events["ts"].dt.normalize()
    win = day.groupby(events["station_id"]).agg(first_day="min", last_day="max")
    return win.reset_index()


def known_mask_intervals() -> list[tuple[pd.Timestamp, pd.Timestamp]]:
    """config.OUTAGE_RANGES → KST aware 반개구간 [start, end) 목록."""
    return [
        (pd.Timestamp(start, tz=config.TZ), pd.Timestamp(end, tz=config.TZ))
        for start, end in config.OUTAGE_RANGES
    ]


def in_any_interval(ts: pd.Series | pd.DatetimeIndex,
                    intervals: list[tuple[pd.Timestamp, pd.Timestamp]]) -> pd.Series:
    """각 시각이 구간 목록 중 하나에라도 속하는지 (반개구간 [start, end))."""
    values = pd.Series(ts) if isinstance(ts, pd.DatetimeIndex) else ts
    hit = pd.Series(False, index=values.index)
    for start, end in intervals:
        hit |= (values >= start) & (values < end)
    return hit


def zero_rental_days(rental_ts: pd.Series) -> pd.DatetimeIndex:
    """도시 전체 대여가 일 단위 0건인 날짜 — 시스템 장애로 간주, 마스크 자동 편입 (계약 §1)."""
    present = pd.DatetimeIndex(rental_ts.dt.normalize().drop_duplicates())
    all_days = pd.date_range(present.min(), present.max(), freq="D", tz=config.TZ)
    return all_days.difference(present)


def month_buckets(month: pd.Period,
                  mask_intervals: list[tuple[pd.Timestamp, pd.Timestamp]]) -> pd.DatetimeIndex:
    """해당 월의 15분 버킷 시작 시각 전체 — 마스크 구간의 버킷은 행 자체를 만들지 않는다."""
    start = month.start_time.tz_localize(config.TZ)
    end = (month + 1).start_time.tz_localize(config.TZ)
    buckets = pd.date_range(start, end, freq=f"{config.BUCKET_MINUTES}min", inclusive="left")
    keep = ~in_any_interval(buckets, mask_intervals).to_numpy()
    return buckets[keep].as_unit("us")


def build_grid(buckets: pd.DatetimeIndex, windows: pd.DataFrame) -> pd.DataFrame:
    """운영 구간과 겹치는 대여소 × 버킷의 완전 격자 (0-fill 대상 행 전체)."""
    if len(buckets) == 0:
        return pd.DataFrame(columns=["station_id", "bucket_start"])
    lo, hi = buckets[0].normalize(), buckets[-1].normalize()
    sub = windows[(windows["first_day"] <= hi) & (windows["last_day"] >= lo)]
    grid = sub.merge(pd.DataFrame({"bucket_start": buckets}), how="cross")
    day = grid["bucket_start"].dt.normalize()
    grid = grid[(day >= grid["first_day"]) & (day <= grid["last_day"])]
    return grid[["station_id", "bucket_start"]].reset_index(drop=True)


# ── 파이프라인 ──────────────────────────────────────────────────────────

def load_events(trips_dir: Path, log: io.TextIOBase) -> tuple[pd.DataFrame, pd.DataFrame]:
    """trips Parquet → (대여 이벤트, 반납 이벤트). 각 프레임 columns=[ts, station_id]."""
    files = sorted(trips_dir.glob("trips_*.parquet"))
    if not files:
        raise FileNotFoundError(f"trips Parquet 없음 — 1단계 preprocess 먼저 실행: {trips_dir}")
    trips = pd.concat(
        [
            pd.read_parquet(
                f, columns=["rented_at", "rental_station_id", "returned_at", "return_station_id"]
            )
            for f in files
        ],
        ignore_index=True,
    )
    print(f"trips 로드: {len(files)}개 파일, {len(trips):,}행", file=log)

    def event_frame(ts_col: str, station_col: str, name: str) -> pd.DataFrame:
        ev = trips[[ts_col, station_col]].rename(columns={ts_col: "ts", station_col: "station_id"})
        n0 = len(ev)
        ev = ev.dropna()
        dropped = n0 - len(ev)
        if dropped:
            print(f"{name} 이벤트 결측(시각/대여소ID) 제외: {dropped:,}건", file=log)
        ev["station_id"] = ev["station_id"].astype(str)
        return ev

    return event_frame("rented_at", "rental_station_id", "대여"), event_frame(
        "returned_at", "return_station_id", "반납"
    )


def bucket_counts(events: pd.DataFrame, value_name: str) -> pd.DataFrame:
    ev = events.assign(bucket_start=bucket_floor(events["ts"]))
    out = ev.groupby(["station_id", "bucket_start"], observed=True).size().rename(value_name)
    return out.reset_index()


def compress_days(days: pd.DatetimeIndex) -> str:
    """연속 날짜를 'YYYY-MM-DD~YYYY-MM-DD' 구간 문자열로 압축 (리포트 가독성)."""
    if len(days) == 0:
        return "(없음)"
    days = days.sort_values()
    parts, start, prev = [], days[0], days[0]
    for d in days[1:]:
        if (d - prev).days != 1:
            parts.append((start, prev))
            start = d
        prev = d
    parts.append((start, prev))
    return ", ".join(
        f"{s:%Y-%m-%d}" if s == e else f"{s:%Y-%m-%d}~{e:%Y-%m-%d}" for s, e in parts
    )


def main() -> None:
    log = io.StringIO()
    t0 = time.monotonic()
    rent_ev, ret_ev = load_events(config.TRIPS_DIR, log)

    # 마스크: 알려진 장애 구간(정밀 시각) + 도시 전체 일 단위 0건 날짜 자동 편입 (계약 §1 ①)
    zero_days = zero_rental_days(rent_ev["ts"])
    intervals = known_mask_intervals() + [(d, d + pd.Timedelta(days=1)) for d in zero_days]
    print(f"\n== 누락 마스크 ==", file=log)
    for start, end in known_mask_intervals():
        print(f"알려진 장애 구간(config): [{start} ~ {end})", file=log)
    print(f"도시 전체 0건 날짜(자동 발견 {len(zero_days)}일, 안전망): {compress_days(zero_days)}", file=log)
    n_masked_rent = int(in_any_interval(rent_ev["ts"], intervals).sum())
    n_masked_ret = int(in_any_interval(ret_ev["ts"], intervals).sum())
    print(f"마스크 구간 내 이벤트 (행 미생성으로 제외): 대여 {n_masked_rent:,} / 반납 {n_masked_ret:,}", file=log)

    # 운영 구간 (계약 §1 ②) — 대여·반납 통틀어
    windows = station_windows(pd.concat([rent_ev, ret_ev], ignore_index=True))
    print(f"\n대여소 수(전 기간 등장): {len(windows):,}", file=log)

    # 이벤트 → 버킷 카운트 (마스크 제외는 격자 쪽에서 — 격자에 없는 행은 join에서 소멸)
    rent_counts = bucket_counts(rent_ev, "rentals")
    ret_counts = bucket_counts(ret_ev, "returns")

    # 월별 격자 생성 + 카운트 조인 + 0-fill 저장
    # KST 벽시계 기준 월 — tz를 명시적으로 벗겨 Period 변환 (aware→Period 암묵 변환 경고 방지)
    gmin = rent_ev["ts"].min().tz_localize(None).to_period("M")
    gmax = rent_ev["ts"].max().tz_localize(None).to_period("M")
    out_dir = config.ARTIFACTS_DIR / "buckets"
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("buckets_*.parquet"):
        old.unlink()

    def by_month(counts: pd.DataFrame) -> dict:
        month_key = counts["bucket_start"].dt.tz_localize(None).dt.to_period("M")
        return dict(iter(counts.groupby(month_key)))

    rent_by_month = by_month(rent_counts)
    ret_by_month = by_month(ret_counts)

    print(f"\n== 월별 버킷 행수 (운영 대여소 × 96 × 일수 − 마스크) ==", file=log)
    total_rows = 0
    for month in pd.period_range(gmin, gmax, freq="M"):
        grid = build_grid(month_buckets(month, intervals), windows)
        if grid.empty:
            print(f"{month}  0행 (전체 마스크)", file=log)
            continue
        for counts, col in ((rent_by_month.get(month), "rentals"), (ret_by_month.get(month), "returns")):
            if counts is None:
                grid[col] = 0
            else:
                grid = grid.merge(counts[["station_id", "bucket_start", col]],
                                  on=["station_id", "bucket_start"], how="left")
                grid[col] = grid[col].fillna(0)
            grid[col] = grid[col].astype("int16")
        grid["station_id"] = grid["station_id"].astype("category")
        grid.to_parquet(out_dir / f"buckets_{month}.parquet", index=False)
        n_st = grid["station_id"].nunique()
        print(f"{month}  {len(grid):>10,}행 | 운영 대여소 {n_st:,} | 대여 {int(grid['rentals'].sum()):,} / 반납 {int(grid['returns'].sum()):,}", file=log)
        total_rows += len(grid)

    print(f"\n총 버킷 행수: {total_rows:,} ({time.monotonic()-t0:.0f}s)", file=log)
    print(f"Parquet 저장: {out_dir}", file=log)

    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = config.REPORTS_DIR / "buckets_report.txt"
    report_path.write_text(log.getvalue(), encoding="utf-8")
    try:
        print(log.getvalue())
    except UnicodeEncodeError:
        sys.stdout.buffer.write(log.getvalue().encode("utf-8", errors="replace"))
    print(f"리포트 저장: {report_path}")


if __name__ == "__main__":
    main()
