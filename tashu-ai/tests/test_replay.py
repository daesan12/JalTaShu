# -*- coding: utf-8 -*-
"""9단계 입력 — S3 Parquet 로더(완전 snapshot 판정·tz) · 리플레이(누출 없는 실제값 매칭, 산출 스키마).

가짜 dt= 파티션을 tmp_path에 만들어 로더를 검증하고, 리플레이는 실제 모델 3파일이 있을 때만 돈다.
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src import replay, serve, snapshots


def kst(s):
    return pd.Timestamp(s, tz=config.TZ)


def write_snapshot_partitions(root: Path, stations, start, end, bikes_fn, drop_at=None, drop_station="ST0002"):
    """45초 폴링 스냅샷을 dt=날짜 폴더에 나눠 저장. drop_at 시각의 snapshot은 drop_station 행을 빼서 불완전하게."""
    times = pd.date_range(kst(start), kst(end), freq="45s")
    rows = []
    for i, t in enumerate(times):
        for j, sid in enumerate(stations):
            if drop_at is not None and t == kst(drop_at) and sid == drop_station:
                continue
            rows.append({"collected_at": t, "station_id": sid, "station_name": sid, "lat": 36.35 + j * 0.001,
                         "lon": 127.38, "bikes": bikes_fn(i, j)})
    df = pd.DataFrame(rows)
    for day, part in df.groupby(df["collected_at"].dt.normalize()):
        d = root / f"dt={day:%Y-%m-%d}"
        d.mkdir(parents=True, exist_ok=True)
        part.to_parquet(d / f"snapshots-{day:%H%M%S}-x.parquet", index=False)
    return df


def write_weather_partitions(root: Path, start, end, rain_hours=()):
    times = pd.date_range(kst(start), kst(end), freq="h")
    df = pd.DataFrame({"observed_at": times, "fetched_at": times + pd.Timedelta(minutes=42), "nx": 67, "ny": 100,
                       "temperature": 20.0, "rainfall_1h": [3.0 if t in [kst(r) for r in rain_hours] else 0.0 for t in times],
                       "source": "test"})
    for day, part in df.groupby(df["observed_at"].dt.normalize()):
        d = root / f"dt={day:%Y-%m-%d}"
        d.mkdir(parents=True, exist_ok=True)
        part.to_parquet(d / f"weather-{day:%H%M}-nx67-ny100.parquet", index=False)
    return df


STATIONS = ["ST0000", "ST0002", "ST0003"]


def test_load_snapshots_filters_incomplete_and_converts_tz(tmp_path):
    """대여소 3곳 중 1곳 빠진 snapshot(67%)은 페이지 누락으로 제외; 날짜 파티션 경계를 넘어 읽고 tz 유지."""
    write_snapshot_partitions(tmp_path, STATIONS, "2026-09-10 23:00", "2026-09-11 01:00",
                              bikes_fn=lambda i, j: 5, drop_at="2026-09-11 00:15")
    out = snapshots.load_snapshots(kst("2026-09-10 23:00"), kst("2026-09-11 01:00"), root=tmp_path)
    assert str(out["snapshot_time"].dt.tz) == config.TZ
    assert kst("2026-09-11 00:15") not in set(out["snapshot_time"])  # 불완전 snapshot 제외
    assert set(out["station_id"]) == set(STATIONS)
    per_snap = out.groupby("snapshot_time").size()
    assert (per_snap == len(STATIONS)).all()
    assert out["snapshot_time"].min() == kst("2026-09-10 23:00")  # 날짜 파티션 경계를 넘어 읽음


def test_load_ns_parquet_matches_serving_time_unit(tmp_path):
    """S3 스냅샷은 ns, 날씨는 us로 저장돼 있다. 로더는 둘 다 서빙 단위(us)로 맞춰 merge_asof·date_range와 조인된다.

    (실데이터 스모크에서 잡힌 회귀: pandas 3 문자열 Timestamp=us vs Parquet=ns → MergeError)
    """
    df = write_snapshot_partitions(tmp_path / "snap", STATIONS, "2026-09-11 08:00", "2026-09-11 09:30",
                                   bikes_fn=lambda i, j: 5)
    ns = df.assign(collected_at=df["collected_at"].dt.as_unit("ns"))
    d = tmp_path / "snap" / "dt=2026-09-11"
    for f in d.glob("*.parquet"):
        f.unlink()
    ns.to_parquet(d / "snapshots-080000-x.parquet", index=False)
    assert pd.read_parquet(d / "snapshots-080000-x.parquet")["collected_at"].dt.unit == "ns"

    snaps = snapshots.load_snapshots(kst("2026-09-11 08:00"), kst("2026-09-11 09:30"), root=tmp_path / "snap")
    assert snaps["snapshot_time"].dt.unit == snapshots.TIME_UNIT
    weather = snapshots.load_weather(kst("2026-09-10"), kst("2026-09-11 09:30"),
                                     root=(write_weather_partitions(tmp_path / "wx", "2026-09-10 00:00", "2026-09-11 09:00"), tmp_path / "wx")[1])
    assert weather["obs_time"].dt.unit == snapshots.TIME_UNIT

    t = pd.date_range(kst("2026-09-11 09:00"), kst("2026-09-11 09:20"), freq="5min").as_unit(snapshots.TIME_UNIT)[0]
    actual = replay.actual_bikes_at(snaps, t, pd.Index(STATIONS))   # merge_asof — 단위가 다르면 MergeError
    assert (actual == 5).all()


def test_complete_snapshot_tolerates_small_station_fluctuation():
    """실측 패턴: 1,374곳 중 몇 곳이 빠진 1,368~1,373행 snapshot은 완전, 1,000행(페이지 누락)은 불완전."""
    t0 = kst("2026-09-10 08:00")
    rows = []
    for k, n in enumerate([1374, 1373, 1368, 1000, 1372]):
        t = t0 + pd.Timedelta(seconds=45 * k)
        rows += [{"collected_at": t, "station_id": f"ST{i:04d}"} for i in range(n)]
    ok = snapshots.complete_snapshot_times(pd.DataFrame(rows))
    assert len(ok) == 4 and t0 + pd.Timedelta(seconds=45 * 3) not in ok


def test_load_snapshots_respects_range_and_empty(tmp_path):
    write_snapshot_partitions(tmp_path, STATIONS, "2026-09-11 00:00", "2026-09-11 02:00", bikes_fn=lambda i, j: 1)
    out = snapshots.load_snapshots(kst("2026-09-11 01:00"), kst("2026-09-11 01:30"), root=tmp_path)
    assert out["snapshot_time"].min() >= kst("2026-09-11 01:00") and out["snapshot_time"].max() <= kst("2026-09-11 01:30")
    empty = snapshots.load_snapshots(kst("2026-09-20"), kst("2026-09-21"), root=tmp_path)
    assert empty.empty and list(empty.columns)[:3] == ["station_id", "snapshot_time", "bikes"]


def test_load_weather_dedup_and_shape(tmp_path):
    write_weather_partitions(tmp_path, "2026-09-10 00:00", "2026-09-11 12:00", rain_hours=["2026-09-11 08:00"])
    w = snapshots.load_weather(kst("2026-09-10 00:00"), kst("2026-09-11 12:00"), root=tmp_path)
    assert list(w.columns) == ["obs_time", "temperature", "rainfall_1h"]
    assert w["obs_time"].is_monotonic_increasing and w["obs_time"].is_unique
    assert w.loc[w["obs_time"] == kst("2026-09-11 08:00"), "rainfall_1h"].iloc[0] == 3.0


def test_merge_weather_prefers_kma_and_fills_gaps():
    times = pd.date_range(kst("2026-09-15 00:00"), kst("2026-09-16 05:00"), freq="h")
    kma = pd.DataFrame({"obs_time": times[-6:], "temperature": 20.0, "rainfall_1h": 0.0})      # 9/16 00~05시만
    om = pd.DataFrame({"obs_time": times, "temperature": 99.0, "rainfall_1h": 0.0})            # 전 구간
    merged, summary = snapshots.merge_weather(kma, om)
    assert len(merged) == len(times) and merged["obs_time"].is_unique
    assert (merged.loc[merged["obs_time"].isin(kma["obs_time"]), "temperature"] == 20.0).all()  # 겹치면 기상청
    assert (merged.loc[~merged["obs_time"].isin(kma["obs_time"]), "temperature"] == 99.0).all()
    s = summary.set_index("source")["hours"]
    assert s["kma"] == 6 and s["open-meteo"] == len(times) - 6


def test_coverage_reports_gap(tmp_path):
    a = write_snapshot_partitions(tmp_path, STATIONS, "2026-09-11 00:00", "2026-09-11 01:00", bikes_fn=lambda i, j: 1)
    write_snapshot_partitions(tmp_path / "later", STATIONS, "2026-09-11 02:00", "2026-09-11 03:00", bikes_fn=lambda i, j: 1)
    snaps = snapshots.load_snapshots(kst("2026-09-11"), kst("2026-09-12"), root=tmp_path)
    later = snapshots.load_snapshots(kst("2026-09-11"), kst("2026-09-12"), root=tmp_path / "later")
    cov = snapshots.coverage(pd.concat([snaps, later], ignore_index=True))
    assert cov.loc[kst("2026-09-11"), "max_gap_min"] == pytest.approx(60.0)
    assert cov.loc[kst("2026-09-11"), "stations"] == len(STATIONS)


def test_time_window_binary_search_matches_mask():
    """정렬된 표 + DatetimeIndex 슬라이스는 불리언 마스크 (lo, hi] 와 같은 행을 돌려준다 (경계 포함 여부까지)."""
    times = pd.date_range(kst("2026-09-11 08:00"), kst("2026-09-11 09:00"), freq="45s")
    snaps = pd.DataFrame({"station_id": "ST0000", "snapshot_time": times, "bikes": 1}).sample(frac=1, random_state=0)
    snaps = snaps.sort_values("snapshot_time", kind="stable").reset_index(drop=True)
    idx = pd.DatetimeIndex(snaps["snapshot_time"])
    lo, hi = kst("2026-09-11 08:15"), kst("2026-09-11 08:30")           # 둘 다 정확히 스냅샷 시각
    fast = replay.time_window(snaps, lo, hi, idx)
    slow = replay.time_window(snaps, lo, hi)
    pd.testing.assert_frame_equal(fast, slow)
    assert fast["snapshot_time"].min() > lo and fast["snapshot_time"].max() == hi


def test_actual_bikes_backward_only():
    snaps = pd.DataFrame({"station_id": ["ST0000"] * 3,
                          "snapshot_time": [kst("2026-09-11 10:00"), kst("2026-09-11 10:04"), kst("2026-09-11 10:06")],
                          "bikes": [5, 2, 9]})
    st = pd.Index(["ST0000", "ST0009"])
    got = replay.actual_bikes_at(snaps, kst("2026-09-11 10:05"), st)
    assert got["ST0000"] == 2          # 10:06(미래)은 쓰지 않음
    assert np.isnan(got["ST0009"])     # 스냅샷 없는 대여소 → NaN
    assert np.isnan(replay.actual_bikes_at(snaps, kst("2026-09-11 10:10"), st)["ST0000"])  # 허용 3분 초과


needs_models = pytest.mark.skipif(
    not (config.MODELS_DIR / "lgbm_lambda.joblib").exists() or not config.PROFILE_PATH.exists(),
    reason="모델 아티팩트 없음",
)


@needs_models
def test_replay_at_schema_and_actuals(tmp_path):
    art = serve.load_artifacts()
    stations = sorted(art.known_stations)[:40] + ["NEWST1"]  # 프로파일 있는 40곳 + 신규 1곳
    # bikes: 대여소 j는 j%3 대 (0·1·2) — 일부는 고갈 상태
    df = write_snapshot_partitions(tmp_path / "snap", stations, "2026-09-10 08:00", "2026-09-11 12:00",
                                   bikes_fn=lambda i, j: j % 3)
    write_weather_partitions(tmp_path / "wx", "2026-09-09 00:00", "2026-09-11 12:00", rain_hours=["2026-09-11 07:00"])
    snaps = snapshots.load_snapshots(kst("2026-09-10 08:00"), kst("2026-09-11 12:00"), root=tmp_path / "snap")
    weather = snapshots.load_weather(kst("2026-09-09"), kst("2026-09-11 12:00"), root=tmp_path / "wx")

    t = kst("2026-09-11 10:10")
    out = replay.replay_at(t, snaps, weather, art)
    assert out is not None
    assert set(out["horizon_min"]) == set(config.EVAL_HORIZONS_MIN)
    assert len(out) == len(stations) * len(config.EVAL_HORIZONS_MIN)
    for col in ("prob_model", "prob_bl_profile", "prob_bl_current", "bikes_pred", "bikes_actual", "depleted"):
        assert col in out.columns
    assert out["prob_model"].between(0, 1).all()
    # 실제값: bikes가 시간 불변이라 도착 시점 실제 = s, 고갈 = s ≤ 0
    assert (out["bikes_actual"] == out["s"]).all()
    assert (out["depleted"] == (out["s"] <= 0).astype(float)).all()
    # s = 0인 곳은 모델·현재잔여 베이스라인 모두 확률 1
    zero = out[out["s"] == 0]
    assert (zero["prob_model"] == 1.0).all() and (zero["prob_bl_current"] == 1.0).all()
    # 신규 대여소: 프로파일 베이스라인 NaN, 모델은 값 있음
    new = out[out["station_id"] == "NEWST1"]
    assert new["prob_bl_profile"].isna().all() and (~new["has_profile"]).all() and new["prob_model"].notna().all()
    assert out["has_delta"].all()  # 65분 이력 충분


@needs_models
def test_replay_blocks_without_history(tmp_path):
    art = serve.load_artifacts()
    stations = sorted(art.known_stations)[:5]
    write_snapshot_partitions(tmp_path / "snap", stations, "2026-09-11 09:50", "2026-09-11 10:30", bikes_fn=lambda i, j: 3)
    write_weather_partitions(tmp_path / "wx", "2026-09-09 00:00", "2026-09-11 12:00")
    snaps = snapshots.load_snapshots(kst("2026-09-11 09:00"), kst("2026-09-11 11:00"), root=tmp_path / "snap")
    weather = snapshots.load_weather(kst("2026-09-09"), kst("2026-09-11 12:00"), root=tmp_path / "wx")
    assert replay.replay_at(kst("2026-09-11 10:10"), snaps, weather, art) is None  # 이력 20분 → 차단
    table = replay.replay_range(kst("2026-09-11 10:00"), kst("2026-09-11 10:20"), 5, art, snaps, weather)
    assert table.empty
