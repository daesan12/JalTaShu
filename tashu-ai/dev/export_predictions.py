# -*- coding: utf-8 -*-
"""예측값 JSON 내보내기 — FE·BE 연결 시 실제 대여소·실제 값으로 목업/테스트하기 위한 파일.

두 소스 중 하나:
  --from-redis     : 지금 Redis에 있는 pred:* 전부 (운영은 Server B에서 인프라가 실행, 로컬은 dev/.env)
  --from-replay T  : 리플레이 테이블의 시점 T(KST, 예 "2026-09-11 08:10") 예측 (S3 스냅샷 기반, Redis 불필요)
출력 형식 (백엔드에 전달한 Redis 값과 동일 필드):
  {"generated_at": "...", "source": "...", "horizons": [1..15 또는 5,10,15],
   "stations": {"ST0208": {"5": {"bikes": 3.0, "prob_out": 0.42}, ...}, ...}}
실행: python -m dev.export_predictions --env-file dev/.env --from-redis --out artifacts/predictions_sample.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src import replay, serve


def from_redis(client) -> tuple[dict, list[int]]:
    stations: dict[str, dict[str, dict]] = {}
    horizons: set[int] = set()
    for key in client.scan_iter(match="pred:*", count=5000):
        _, sid, h = key.split(":")
        raw = client.get(key)
        if raw is None:
            continue
        v = json.loads(raw)
        stations.setdefault(sid, {})[h] = {"bikes": v["bikes"], "prob_out": v["prob_out"]}
        horizons.add(int(h))
    return stations, sorted(horizons)


def from_replay(t: pd.Timestamp, start: pd.Timestamp, end: pd.Timestamp) -> tuple[dict, list[int]]:
    table = pd.read_parquet(replay.output_path(start, end))
    at = table[pd.to_datetime(table["t"]) == t]
    if at.empty:
        raise ValueError(f"리플레이 테이블에 시점 {t} 없음 (step={config.REPLAY_STEP_MIN}분 격자인지 확인)")
    stations: dict[str, dict[str, dict]] = {}
    for sid, h, bikes, prob in at[["station_id", "horizon_min", "bikes_pred", "prob_model"]].itertuples(index=False):
        stations.setdefault(str(sid), {})[str(int(h))] = {"bikes": round(float(bikes), 1), "prob_out": round(float(prob), 3)}
    return stations, sorted(int(h) for h in at["horizon_min"].unique())


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="예측값 JSON 내보내기 (FE·BE 연결용)")
    parser.add_argument("--env-file", default=None)
    parser.add_argument("--from-redis", action="store_true")
    parser.add_argument("--from-replay", metavar="T", default=None, help='KST 시각, 예 "2026-09-11 08:10"')
    parser.add_argument("--start", default=None, help="--from-replay 용 리플레이 기간 시작일")
    parser.add_argument("--end", default=None, help="--from-replay 용 리플레이 기간 종료일")
    parser.add_argument("--out", default=str(config.ARTIFACTS_DIR / "predictions_sample.json"))
    args = parser.parse_args(argv)
    if args.env_file:
        serve.load_env_file(args.env_file)

    if args.from_redis:
        stations, horizons = from_redis(serve.redis_connect())
        source = "redis"
    elif args.from_replay:
        if not (args.start and args.end):
            parser.error("--from-replay 에는 --start/--end 가 필요합니다")
        start = pd.Timestamp(args.start, tz=config.TZ)
        end = pd.Timestamp(args.end, tz=config.TZ) - pd.Timedelta(minutes=1)
        stations, horizons = from_replay(pd.Timestamp(args.from_replay, tz=config.TZ), start, end)
        source = f"replay@{args.from_replay}"
    else:
        parser.error("--from-redis 또는 --from-replay T 중 하나를 지정하세요")

    payload = {
        "generated_at": pd.Timestamp.now(tz=config.TZ).floor("s").isoformat(),
        "source": source,
        "key_pattern": config.REDIS_KEY_PATTERN,
        "horizons": horizons,
        "stations": stations,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{out}: 대여소 {len(stations):,}곳 × 지평 {len(horizons)}개 ({source})")


if __name__ == "__main__":
    main()
