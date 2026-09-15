# -*- coding: utf-8 -*-
"""1단계: 원본 대여이력 CSV 로드 → 정규화 → dedupe → 관제센터 반납 행 제외 → 월별 Parquet.

실행:  tashu-ai/ 디렉터리에서  python -m src.preprocess

원칙 (docs/피처_스키마_계약.md·AI_설계서.md):
- 파일명 불신 — 파티셔닝은 실제 대여일시 기준 ('25년12월' 파일이 2025-01 데이터인 사례 실측).
- 인코딩 자동판별 (utf-8-sig / cp949 혼재).
- 파일 간 중복은 (자전거번호, 대여일시, 대여대여소ID) 키로 dedupe.
- '타슈관제센터' 대여·반납 행 모두 제외 (재배치·정비 이동 — 수요 아님. Spark와 동일 규칙).
- 모든 시각 Asia/Seoul aware. 누락 마스크 구간의 행 제거는 2단계 buckets.py 책임
  (이벤트별 버킷 단위 마스킹) — 여기서는 구간 내 행수만 리포트한다.

산출물:
- artifacts/trips/trips_YYYY-MM.parquet  (월별 파티션, 실제 대여일시 기준)
- artifacts/reports/preprocess_report.txt / monthly_histogram.csv
"""
from __future__ import annotations

import io
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config

COLUMN_MAP = {
    "자전거번호": "bike_id",
    "대여일시": "rented_at",
    "대여_대여소ID": "rental_station_id",
    "대여_대여소명": "rental_station_name",
    "반납일시": "returned_at",
    "반납_대여소ID": "return_station_id",
    "반납_대여소명": "return_station_name",
}
USECOLS = list(COLUMN_MAP)

# 산출 Parquet에 남길 컬럼 (대여소명은 관제센터 필터에만 쓰고 버린다)
OUTPUT_COLUMNS = [
    "bike_id",
    "rented_at",
    "rental_station_id",
    "returned_at",
    "return_station_id",
    "source_file",
]


def detect_encoding(path: Path, sample_bytes: int = 65536) -> str:
    """파일 앞부분으로 인코딩 판별.

    샘플 경계에서 멀티바이트가 잘리므로 errors="ignore"로 디코드하되, 틀린 인코딩이
    통과하지 못하도록 헤더의 한글 컬럼명("대여일시")이 온전히 복원되는지로 판정한다.
    """
    raw = path.open("rb").read(sample_bytes)
    for enc in config.CSV_ENCODINGS:
        header = raw.decode(enc, errors="ignore").split("\n", 1)[0]
        if "대여일시" in header:
            return enc
    raise ValueError(f"인코딩 판별 실패: {path}")


def parse_kst(series: pd.Series) -> pd.Series:
    """'2022-08-01 0:14' / '2024-08-01 05:00:05' 혼재 문자열 → Asia/Seoul aware timestamp."""
    parsed = pd.to_datetime(series, format="mixed", errors="coerce")
    return parsed.dt.tz_localize(config.TZ)


def load_one(path: Path) -> pd.DataFrame:
    enc = detect_encoding(path)
    # encoding_errors="replace": 끝이 잘린(truncated) 파일 대비 — 실측 1건(extracted 25년05월,
    # 마지막 행의 마지막 필드만 손상). usecols 밖 필드라 영향 없고, 손상 행은 dedupe·NaT 처리로 걸러진다.
    df = pd.read_csv(path, encoding=enc, usecols=USECOLS, dtype=str, encoding_errors="replace")
    df = df.rename(columns=COLUMN_MAP)
    for col in ("bike_id", "rental_station_id", "return_station_id"):
        df[col] = df[col].str.strip()
    df["rented_at"] = parse_kst(df["rented_at"])
    df["returned_at"] = parse_kst(df["returned_at"])
    df["source_file"] = path.name
    return df


def load_all(data_root: Path, log: io.TextIOBase) -> pd.DataFrame:
    # SPARK_DIR(데이터 담당 산출물)은 대여이력이 아니므로 탐색 제외
    files = sorted(f for f in data_root.rglob("*.csv") if config.SPARK_DIR not in f.parents)
    if not files:
        raise FileNotFoundError(f"CSV 없음: {data_root}")
    frames = []
    for i, f in enumerate(files, 1):
        t0 = time.monotonic()
        df = load_one(f)
        print(f"[{i:2d}/{len(files)}] {f.name} — {len(df):,}행 ({time.monotonic()-t0:.1f}s)", file=log)
        frames.append(df)
    out = pd.concat(frames, ignore_index=True)
    for col in ("bike_id", "rental_station_id", "return_station_id", "source_file"):
        out[col] = out[col].astype("category")
    return out


def clean(df: pd.DataFrame, log: io.TextIOBase) -> pd.DataFrame:
    n0 = len(df)
    print(f"\n== 정제 리포트 ==\n원본 총 행수: {n0:,}", file=log)

    # 대여일시 파싱 실패 행은 버킷 배정 불가 → 제거
    bad_rent = df["rented_at"].isna()
    if bad_rent.any():
        print(f"대여일시 파싱 실패 제거: {int(bad_rent.sum()):,}행", file=log)
        df = df[~bad_rent]
    n_bad_return = int(df["returned_at"].isna().sum())
    print(f"반납일시 결측/파싱 실패 (행 유지, 반납 이벤트만 없음): {n_bad_return:,}행", file=log)

    # dedupe — 계약 §7 키. 파일 간 중복 제공분 제거
    n1 = len(df)
    df = df.drop_duplicates(subset=list(config.DEDUPE_KEYS), keep="first")
    print(f"dedupe: {n1:,} → {len(df):,}행 (중복 {n1 - len(df):,}행 제거)", file=log)

    # 관제센터 — 대여·반납 양쪽 제외 (재배치·정비 이동은 수요가 아님. ST1220의 월
    # 1.2만 건 재배치 '대여' 유출 실측 — 설계서에 확정 반영, 2026-09-14 합의).
    ret_cc = df["return_station_name"].str.contains(config.CONTROL_CENTER_KEYWORD, na=False)
    rent_cc = df["rental_station_name"].str.contains(config.CONTROL_CENTER_KEYWORD, na=False)
    cc_names = sorted(
        set(df.loc[ret_cc, "return_station_name"].unique())
        | set(df.loc[rent_cc, "rental_station_name"].unique())
    )
    print(f"관제센터 매칭 명칭: {cc_names}", file=log)
    print(f"관제센터 반납 행 제거: {int(ret_cc.sum()):,}행", file=log)
    print(f"관제센터 대여 행 제거: {int(rent_cc.sum()):,}행 (반납과 중복 포함)", file=log)
    df = df[~(ret_cc | rent_cc)]

    # 누락 마스크 구간 내 행수 리포트 (제거는 2단계 buckets.py에서 이벤트별 마스킹)
    for start, end in config.OUTAGE_RANGES:
        lo = pd.Timestamp(start, tz=config.TZ)
        hi = pd.Timestamp(end, tz=config.TZ) + pd.Timedelta(days=1)
        n_in = int(((df["rented_at"] >= lo) & (df["rented_at"] < hi)).sum())
        print(f"마스크 구간 {start}~{end} 내 대여 행수 (참고): {n_in:,}", file=log)

    print(f"정제 후 총 행수: {len(df):,} (원본 대비 {len(df)/n0:.1%})", file=log)
    return df.reset_index(drop=True)


def monthly_histogram(df: pd.DataFrame, log: io.TextIOBase) -> pd.DataFrame:
    """실제 대여일시 기준 월별 행수 히스토그램 — 검수 체크 5 (사용 월 확정 근거)."""
    counts = df["rented_at"].dt.strftime("%Y-%m").value_counts().sort_index()
    hist = counts.rename("rows").rename_axis("month").reset_index()
    peak = counts.max()
    print("\n== 월별 행수 히스토그램 (실제 대여일시 기준 — 파일명 불신) ==", file=log)
    for month, n in counts.items():
        bar = "#" * max(1, round(n / peak * 50))
        print(f"{month}  {n:>9,}  {bar}", file=log)
    print(f"총 {len(counts)}개월 / {int(counts.sum()):,}행", file=log)

    split = pd.Timestamp(config.SPLIT_DATE, tz=config.TZ)
    n_train = int((df["rented_at"] < split).sum())
    n_valid = int((df["rented_at"] >= split).sum())
    print(f"분할 기준 {config.SPLIT_DATE} KST — 학습 {n_train:,}행 / 검증 {n_valid:,}행", file=log)
    return hist


def save_partitions(df: pd.DataFrame, out_dir: Path, log: io.TextIOBase) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("trips_*.parquet"):
        old.unlink()
    month = df["rented_at"].dt.strftime("%Y-%m")
    for m, group in df.groupby(month, observed=True):
        path = out_dir / f"trips_{m}.parquet"
        group[OUTPUT_COLUMNS].to_parquet(path, index=False)
    print(f"\nParquet 저장: {out_dir} ({month.nunique()}개 파일)", file=log)


def main() -> None:
    log = io.StringIO()
    df = load_all(config.DATA_ROOT, log)
    df = clean(df, log)
    hist = monthly_histogram(df, log)
    save_partitions(df, config.TRIPS_DIR, log)

    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    hist.to_csv(config.REPORTS_DIR / "monthly_histogram.csv", index=False)
    report_path = config.REPORTS_DIR / "preprocess_report.txt"
    report_path.write_text(log.getvalue(), encoding="utf-8")

    try:
        print(log.getvalue())
    except UnicodeEncodeError:  # cp949 콘솔 대비
        sys.stdout.buffer.write(log.getvalue().encode("utf-8", errors="replace"))
    print(f"리포트 저장: {report_path}")


if __name__ == "__main__":
    main()
