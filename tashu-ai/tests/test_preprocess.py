# -*- coding: utf-8 -*-
"""1단계 preprocess 단위 테스트. 실행: tashu-ai/ 에서  python -m pytest"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src.preprocess import detect_encoding, parse_kst

HEADER = "자전거번호,대여일시,대여_대여소ID\n"


def test_detect_encoding_cp949(tmp_path):
    p = tmp_path / "cp949.csv"
    p.write_bytes((HEADER + "DJ2-0001,2022-08-01 0:14,ST0001\n").encode("cp949"))
    assert detect_encoding(p) == "cp949"


def test_detect_encoding_utf8_sig(tmp_path):
    p = tmp_path / "utf8.csv"
    p.write_bytes((HEADER + "DJ2-0001,2022-08-01 0:14,ST0001\n").encode("utf-8-sig"))
    assert detect_encoding(p) == "utf-8-sig"


def test_detect_encoding_multibyte_cut_at_sample_boundary(tmp_path):
    """샘플 경계에서 한글 멀티바이트가 잘려도 판별이 실패하면 안 된다 (실측 사고 지점)."""
    row = "DJ2-0001,2022-08-01 0:14,ST0001,둔산동대여소\n"
    body = HEADER + row * 3000
    raw = body.encode("cp949")
    p = tmp_path / "cut.csv"
    p.write_bytes(raw)
    # 홀수 바이트 샘플 → 한글 2바이트 문자 가운데가 잘리는 경계를 강제
    assert detect_encoding(p, sample_bytes=65535) == "cp949"


def test_parse_kst_mixed_formats_are_aware():
    s = pd.Series(["2022-08-01 0:14", "2024-08-01 05:00:05"])
    out = parse_kst(s)
    assert str(out.dt.tz) == config.TZ  # naive 금지
    assert out.iloc[0] == pd.Timestamp("2022-08-01 00:14:00", tz=config.TZ)
    assert out.iloc[1] == pd.Timestamp("2024-08-01 05:00:05", tz=config.TZ)


def test_parse_kst_invalid_becomes_nat():
    out = parse_kst(pd.Series(["not-a-date", ""]))
    assert out.isna().all()


def test_dedupe_keys_are_full_row():
    # 계약 §7 원문은 3키지만 파일 내 '유령 쌍'(0분 자기반납+진짜 여정) 실측으로
    # 완전 행 키(반납 포함) 확정 — config.py 주석 참조, 계약 개정 대기
    assert tuple(config.DEDUPE_KEYS) == (
        "bike_id", "rented_at", "rental_station_id", "returned_at", "return_station_id"
    )


def test_dedupe_drops_cross_file_duplicates_keeps_ghost_pairs():
    df = pd.DataFrame(
        {
            "bike_id": ["DJ2-1", "DJ2-1", "DJ2-1"],
            "rented_at": parse_kst(pd.Series(["2024-08-01 05:00:05"] * 3)),
            "rental_station_id": ["ST0001", "ST0001", "ST0001"],
            # a.csv의 유령(0분 자기반납) + 진짜 여정, b.csv의 완전 중복(진짜 여정 재등장)
            "returned_at": parse_kst(pd.Series(["2024-08-01 05:00:05", "2024-08-01 05:20:00", "2024-08-01 05:20:00"])),
            "return_station_id": ["ST0001", "ST0002", "ST0002"],
            "source_file": ["a.csv", "a.csv", "b.csv"],
        }
    )
    out = df.drop_duplicates(subset=list(config.DEDUPE_KEYS), keep="first")
    assert len(out) == 2  # 파일 간 완전 중복만 제거, 유령 쌍(반납 다름)은 유지
