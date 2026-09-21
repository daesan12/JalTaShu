# -*- coding: utf-8 -*-
"""10단계 backtest 테스트 — 후보 기하(거리·도보분·평가 지평) · 두 정책의 선택 규칙 · 감소율 산출.

합성 리플레이: 고갈 확률이 실제 고갈을 잘 맞히는 세계에서 AI 정책의 헛걸음율이 현재 잔여 정책보다
낮아야 하고, 확률이 무의미한(모두 같은) 세계에서는 두 정책이 같아야 한다.
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src import backtest


def grid_stations(n=6, spacing_m=300.0):
    """동서로 spacing 간격 일렬 배치 (위도 36.35 근처에서 경도 1도 ≈ 89.7km)."""
    lon_step = spacing_m / 89_700.0
    return pd.DataFrame({"station_id": [f"ST{i:04d}" for i in range(n)],
                         "lat": 36.35, "lon": 127.38 + np.arange(n) * lon_step})


def test_eval_horizon_rounds_up_to_grid():
    # EVAL 그리드가 60분까지 확장(2026-09-21)되어 도보 20분은 클램프(15) 대신 30분 지평으로 올림된다
    got = backtest.eval_horizon(np.array([1, 5, 6, 10, 12, 15, 20]))
    assert got.tolist() == [5, 5, 10, 10, 15, 15, 30]


def test_candidate_table_geometry():
    cand = backtest.candidate_table(grid_stations(), k=3, max_walk_m=700, speed_mpm=80)
    me = cand[(cand["origin"] == "ST0002")]
    assert set(me["station_id"]) == {"ST0002", "ST0001", "ST0003"}  # 자기 + 양옆 300m
    self_row = me[me["station_id"] == "ST0002"].iloc[0]
    assert self_row["dist_m"] == 0 and self_row["walk_min"] == 1 and self_row["horizon_min"] == 5
    side = me[me["station_id"] == "ST0003"].iloc[0]
    assert side["dist_m"] == pytest.approx(300, rel=0.02) and side["walk_min"] == 4 and side["horizon_min"] == 5
    # 반경 밖(600m, 2칸)은 k=3이라도 제외
    far = backtest.candidate_table(grid_stations(), k=5, max_walk_m=450)
    assert far[far["origin"] == "ST0002"]["dist_m"].max() < 450


def synthetic_replay(stations, times, informative=True, seed=0):
    """각 (t, station, h)에 s·prob·depleted. informative=True면 prob가 실제 고갈을 강하게 예고."""
    rng = np.random.default_rng(seed)
    rows = []
    for t in times:
        for sid in stations["station_id"]:
            s = int(rng.integers(0, 4))
            will_deplete = rng.random() < (0.5 if s >= 1 else 1.0)
            for h in config.EVAL_HORIZONS_MIN:
                if s == 0:
                    p, dep = 1.0, 1.0
                elif informative:
                    p, dep = (0.9 if will_deplete else 0.05), float(will_deplete)
                else:
                    p, dep = 0.3, float(will_deplete)
                rows.append({"t": t, "station_id": sid, "horizon_min": h, "s": float(s),
                             "prob_model": p, "depleted": dep})
    return pd.DataFrame(rows)


def test_ai_policy_reduces_misses_when_probabilities_informative():
    stations = grid_stations(n=8)
    times = pd.date_range("2026-09-11 08:00", periods=30, freq="5min", tz=config.TZ)
    table = synthetic_replay(stations, times, informative=True)
    cand = backtest.candidate_table(stations, k=4, max_walk_m=1000)
    dec = backtest.simulate(table, cand, fail_penalty_min=8)
    summ = backtest.summarize(dec).iloc[0]
    assert summ["decisions"] > 0
    assert summ["miss_rate_ai"] < summ["miss_rate_current"]
    assert summ["miss_reduction"] > 0.3
    assert summ["misses_ai"] == dec["miss_b"].sum()


def test_policies_equal_when_probabilities_uninformative():
    """확률이 전부 같으면(s=0 제외) B는 도보분 최소 = 현재 잔여 있는 최근접 → A와 같은 선택."""
    stations = grid_stations(n=6)
    times = pd.date_range("2026-09-11 08:00", periods=10, freq="5min", tz=config.TZ)
    table = synthetic_replay(stations, times, informative=False)
    dec = backtest.simulate(table, backtest.candidate_table(stations, k=3, max_walk_m=1000))
    assert (dec["chosen_a"] == dec["chosen_b"]).all()
    assert dec["miss_a"].sum() == dec["miss_b"].sum()


def test_simulate_skips_origins_without_any_bike():
    stations = grid_stations(n=3)
    t = pd.Timestamp("2026-09-11 08:00", tz=config.TZ)
    rows = [{"t": t, "station_id": sid, "horizon_min": h, "s": 0.0, "prob_model": 1.0, "depleted": 1.0}
            for sid in stations["station_id"] for h in config.EVAL_HORIZONS_MIN]
    dec = backtest.simulate(pd.DataFrame(rows), backtest.candidate_table(stations, k=3, max_walk_m=1000))
    assert dec.empty


def test_current_policy_picks_nearest_with_bike_and_ai_uses_expected_cost():
    stations = grid_stations(n=3)  # ST0000 - ST0001 - ST0002, 300m 간격
    t = pd.Timestamp("2026-09-11 08:00", tz=config.TZ)
    spec = {"ST0000": (1.0, 0.95, 1.0),   # 지금 1대, 고갈확률 0.95, 실제 고갈
            "ST0001": (3.0, 0.05, 0.0),   # 지금 3대, 안전
            "ST0002": (0.0, 1.0, 1.0)}
    rows = [{"t": t, "station_id": sid, "horizon_min": h, "s": s, "prob_model": p, "depleted": d}
            for sid, (s, p, d) in spec.items() for h in config.EVAL_HORIZONS_MIN]
    dec = backtest.simulate(pd.DataFrame(rows), backtest.candidate_table(stations, k=3, max_walk_m=1000), fail_penalty_min=8)
    me = dec[dec["origin"] == "ST0000"].iloc[0]
    assert me["chosen_a"] == "ST0000" and me["miss_a"] == 1.0       # 현재 잔여 기준: 눈앞 1대 → 헛걸음
    assert me["chosen_b"] == "ST0001" and me["miss_b"] == 0.0       # AI: 1 + 0.95×8 = 8.6 > 4 + 0.05×8 = 4.4


def test_ai_policy_never_recommends_currently_empty_station():
    """빈 출발지(도보 1분, 확률 1 → 비용 9분)가 9분 거리의 잔여 대여소(확률 0.05 → 비용 9.4분)보다 싸도 B는 빈 곳을 고르지 않는다."""
    stations = pd.DataFrame({"station_id": ["O", "F"], "lat": [36.35, 36.35], "lon": [127.38, 127.38 + 720 / 111_000 / np.cos(np.radians(36.35))]})
    cand = backtest.candidate_table(stations, k=2, max_walk_m=1200)
    far = cand[(cand["origin"] == "O") & (cand["station_id"] == "F")].iloc[0]
    t = pd.Timestamp("2026-09-11 08:00", tz=config.TZ)
    rows = []
    for sid, h in cand[["station_id", "horizon_min"]].drop_duplicates().itertuples(index=False):
        s = 0.0 if sid == "O" else 3.0
        rows.append({"t": t, "station_id": sid, "horizon_min": int(h), "s": s,
                     "prob_model": 1.0 if s == 0 else 0.05, "depleted": 1.0 if s == 0 else 0.0})
    dec = backtest.simulate(pd.DataFrame(rows), cand, fail_penalty_min=8)
    origin_o = dec[dec["origin"] == "O"]
    assert len(origin_o) == 1
    assert origin_o.iloc[0]["chosen_a"] == "F" and origin_o.iloc[0]["chosen_b"] == "F"
    assert 1 + 8 < far["walk_min"] + 0.05 * 8   # 전제: 비용식만 따르면 빈 출발지 O가 더 싸다


def test_by_hour_and_report(tmp_path):
    import io
    stations = grid_stations(n=6)
    times = pd.date_range("2026-09-11 08:00", periods=24, freq="30min", tz=config.TZ)
    table = synthetic_replay(stations, times)
    dec = backtest.simulate(table, backtest.candidate_table(stations))
    hourly = backtest.by_hour(dec)
    assert {"hour", "decisions", "miss_rate_current", "miss_rate_ai", "miss_reduction"} <= set(hourly.columns)
    log = io.StringIO()
    backtest.write_report(dec, backtest.summarize(dec), hourly, log)
    assert "헛걸음 감소율" in log.getvalue()
