# -*- coding: utf-8 -*-
"""3단계: station_profile 생성 — 학습 구간(< SPLIT_DATE)만으로 계산 (누출 방지).

실행:  tashu-ai/ 디렉터리에서  python -m src.profile

계약 §5: 스키마 station_id, weekday, slot_of_day, avg_rentals, avg_returns.
- 평균은 **학습 구간 데이터로만** — 검증 구간이 섞이면 build_partials가 즉시 실패한다.
- 운영 구간·마스크 규칙은 2단계 버킷 테이블이 이미 반영 (구간 밖·마스크 날짜 행 부재).
- weekday/slot 계산은 features.py 공용 함수를 import — train/serve 일치의 연장.
"""
from __future__ import annotations

import io
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src.features import slot_of_day, weekday

GROUP_KEYS = ["station_id", "weekday", "slot_of_day"]


def build_partials(buckets: pd.DataFrame) -> pd.DataFrame:
    """버킷 청크 → (station, weekday, slot)별 합·건수. 검증 구간 행이 섞이면 ValueError.

    누출 방지 가드: 프로파일은 학습 구간(< SPLIT_DATE)으로만 계산한다 (계약 §5).
    """
    split = pd.Timestamp(config.SPLIT_DATE, tz=config.TZ)
    if (buckets["bucket_start"] >= split).any():
        n_leak = int((buckets["bucket_start"] >= split).sum())
        raise ValueError(
            f"누출 방지: 프로파일 입력에 검증 구간(≥ {config.SPLIT_DATE}) 행 {n_leak:,}개 — 계약 §5 위반"
        )
    chunk = buckets.assign(
        station_id=buckets["station_id"].astype(str),
        weekday=weekday(buckets["bucket_start"]),
        slot_of_day=slot_of_day(buckets["bucket_start"]),
    )
    return (
        chunk.groupby(GROUP_KEYS, observed=True)
        .agg(
            sum_rentals=("rentals", "sum"),
            sum_returns=("returns", "sum"),
            n_buckets=("rentals", "size"),
        )
        .reset_index()
    )


def merge_partials(total: pd.DataFrame | None, partial: pd.DataFrame) -> pd.DataFrame:
    if total is None:
        return partial
    both = pd.concat([total, partial], ignore_index=True)
    return both.groupby(GROUP_KEYS, observed=True).sum().reset_index()


def finalize_profile(partials: pd.DataFrame) -> pd.DataFrame:
    prof = partials.copy()
    prof["avg_rentals"] = prof["sum_rentals"] / prof["n_buckets"]
    prof["avg_returns"] = prof["sum_returns"] / prof["n_buckets"]
    return prof[GROUP_KEYS + ["avg_rentals", "avg_returns"]]


def main() -> None:
    log = io.StringIO()
    t0 = time.monotonic()
    buckets_dir = config.ARTIFACTS_DIR / "buckets"
    split_month = config.SPLIT_DATE[:7]
    files = [
        f for f in sorted(buckets_dir.glob("buckets_*.parquet"))
        if f.stem.removeprefix("buckets_") < split_month  # 파일 선별 + build_partials 행 단위 가드 이중 방어
    ]
    if not files:
        raise FileNotFoundError(f"버킷 Parquet 없음 — 2단계 buckets 먼저 실행: {buckets_dir}")

    total = None
    for f in files:
        partial = build_partials(pd.read_parquet(f))
        total = merge_partials(total, partial)
    print(f"학습 구간 파일 {len(files)}개 (~{files[-1].stem.removeprefix('buckets_')}) 집계 완료", file=log)

    profile = finalize_profile(total)
    out_dir = config.ARTIFACTS_DIR / "profile"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "station_profile.parquet"
    profile.to_parquet(out_path, index=False)

    n_st = profile["station_id"].nunique()
    full = int((profile.groupby("station_id", observed=True).size() == 7 * config.SLOTS_PER_DAY).sum())
    print(f"프로파일 행수: {len(profile):,} (계약 예상 ~대여소×672)", file=log)
    print(f"대여소 수: {n_st:,} (7요일×96슬롯 전체 보유: {full:,}곳)", file=log)
    print(f"avg_rentals 범위: {profile['avg_rentals'].min():.4f} ~ {profile['avg_rentals'].max():.4f}", file=log)
    print(f"avg_returns 범위: {profile['avg_returns'].min():.4f} ~ {profile['avg_returns'].max():.4f}", file=log)
    peak = profile.loc[profile["avg_rentals"].idxmax()]
    print(
        f"최대 수요 셀: {peak['station_id']} weekday={int(peak['weekday'])} slot={int(peak['slot_of_day'])} "
        f"avg={peak['avg_rentals']:.2f}/15분 ({time.monotonic()-t0:.0f}s)",
        file=log,
    )
    print(f"저장: {out_path}", file=log)

    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (config.REPORTS_DIR / "profile_report.txt").write_text(log.getvalue(), encoding="utf-8")
    try:
        print(log.getvalue())
    except UnicodeEncodeError:
        sys.stdout.buffer.write(log.getvalue().encode("utf-8", errors="replace"))


if __name__ == "__main__":
    main()
