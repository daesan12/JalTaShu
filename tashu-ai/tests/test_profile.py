# -*- coding: utf-8 -*-
"""3단계 profile 테스트 — 누출 방지 가드(완료 기준)·평균 계산·산출물 스키마."""
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src.profile import build_partials, finalize_profile, merge_partials


def kst(s):
    return pd.Timestamp(s, tz=config.TZ)


def bucket_frame(rows):
    return pd.DataFrame(
        {"station_id": [r[0] for r in rows],
         "bucket_start": [kst(r[1]) for r in rows],
         "rentals": [r[2] for r in rows],
         "returns": [r[3] for r in rows]}
    )


def test_leakage_guard_rejects_validation_rows():
    """완료 기준: 2026년(검증 구간) 데이터를 넣으면 실패해야 한다."""
    df = bucket_frame([("ST0001", "2026-01-01 00:00", 1, 0)])
    with pytest.raises(ValueError, match="누출 방지"):
        build_partials(df)


def test_leakage_guard_boundary_exact_split_is_validation():
    """경계 2026-01-01 00:00 KST 정각은 검증 구간(≥) — 거부돼야 한다."""
    ok = bucket_frame([("ST0001", "2025-12-31 23:45", 1, 0)])
    assert len(build_partials(ok)) == 1
    bad = bucket_frame([("ST0001", "2026-01-01 00:00", 0, 0)])
    with pytest.raises(ValueError):
        build_partials(bad)


def test_profile_average_math():
    # 같은 (수요일, slot 33) 셀 2주치: rentals 2·4 → avg 3.0 / returns 1·0 → 0.5
    df = bucket_frame(
        [("ST0001", "2024-06-05 08:15", 2, 1), ("ST0001", "2024-06-12 08:15", 4, 0)]
    )
    prof = finalize_profile(build_partials(df))
    assert len(prof) == 1
    row = prof.iloc[0]
    assert row["weekday"] == 2 and row["slot_of_day"] == 33
    assert row["avg_rentals"] == 3.0 and row["avg_returns"] == 0.5


def test_merge_partials_accumulates_across_chunks():
    a = build_partials(bucket_frame([("ST0001", "2024-06-05 08:15", 2, 1)]))
    b = build_partials(bucket_frame([("ST0001", "2024-06-12 08:15", 4, 0)]))
    prof = finalize_profile(merge_partials(merge_partials(None, a), b))
    assert prof.iloc[0]["avg_rentals"] == 3.0


# ── 통합: 산출물 스키마·범위 (3단계 실행 후) ─────────────────────────────

PROFILE_PATH = config.ARTIFACTS_DIR / "profile" / "station_profile.parquet"
needs_artifact = pytest.mark.skipif(not PROFILE_PATH.exists(), reason="src.profile 먼저 실행")


@needs_artifact
def test_profile_artifact_schema_and_ranges():
    prof = pd.read_parquet(PROFILE_PATH)
    assert list(prof.columns) == ["station_id", "weekday", "slot_of_day", "avg_rentals", "avg_returns"]
    assert prof["weekday"].between(0, 6).all()
    assert prof["slot_of_day"].between(0, config.SLOTS_PER_DAY - 1).all()
    assert prof[["avg_rentals", "avg_returns"]].notna().all().all()  # 관측된 셀만 존재 — NaN 없음
    assert (prof[["avg_rentals", "avg_returns"]] >= 0).all().all()
    assert prof["station_id"].nunique() > 1000
    assert not prof.duplicated(["station_id", "weekday", "slot_of_day"]).any()
