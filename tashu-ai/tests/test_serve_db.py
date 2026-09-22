# -*- coding: utf-8 -*-
"""serve.py ↔ 실제 MySQL 연결 동작 — 로컬 dev 스택(dev/compose.yml)이 있을 때만 실행.

운영 첫 기동에서 발견된 결함(2026-09-17): 루프 내내 재사용하는 연결에 autocommit이 없으면
첫 SELECT가 연 트랜잭션이 닫히지 않아 REPEATABLE READ 스냅샷에 갇히고, 이후 주기가
새로 적재된 snapshot을 보지 못해 매분 '미가동'이 됐다. 이 테스트가 그 회귀를 잡는다.

실행: dev/.env 를 환경변수로 넣고 pytest (`--env-file` 대신 TASHU_AI_DB_* 가 환경에 있어야 함).
"""
import os
import sys
import uuid
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config
from src import serve

ENV_FILE = Path(__file__).resolve().parents[1] / "dev" / ".env"
if ENV_FILE.exists():
    serve.load_env_file(ENV_FILE)


def _db_available() -> bool:
    if not os.environ.get(config.DB_ENV["host"]):
        return False
    try:
        conn = serve.db_connect()
        conn.close()
        return True
    except Exception:
        return False


needs_db = pytest.mark.skipif(not _db_available(), reason="로컬 MySQL(dev/compose.yml) 없음")


def _insert_snapshot(conn, station_id: str, collected_at_kst: pd.Timestamp, bikes: int) -> None:
    snapshot_id = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO {config.SNAPSHOT_TABLE} (event_id, schema_version, snapshot_id, station_count, "
            f"collected_at, station_id, station_name, lat, lon, bikes) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (f"{snapshot_id}:{station_id}", 1, snapshot_id, 1, serve._utc_param(collected_at_kst),
             station_id, "회귀 테스트", 36.35, 127.38, bikes),
        )
    conn.commit()


@needs_db
def test_reused_connection_sees_rows_inserted_after_first_query():
    """같은 연결로 조회 → 다른 연결이 적재 → 다시 조회하면 새 행이 보여야 한다 (autocommit)."""
    reader = serve.db_connect()
    writer = serve.db_connect()
    station = f"TEST{uuid.uuid4().hex[:6]}"
    now = pd.Timestamp.now(tz=config.TZ).floor("s")
    try:
        first = serve.fetch_snapshots(reader, now)
        assert station not in set(first["station_id"])

        _insert_snapshot(writer, station, now - pd.Timedelta(seconds=30), bikes=7)

        second = serve.fetch_snapshots(reader, now)  # 첫 조회와 같은 연결 재사용
        rows = second[second["station_id"] == station]
        assert len(rows) == 1 and rows.iloc[0]["bikes"] == 7, "재사용 연결이 첫 조회 시점 스냅샷에 갇혀 있음"
    finally:
        with writer.cursor() as cur:
            cur.execute(f"DELETE FROM {config.SNAPSHOT_TABLE} WHERE station_id = %s", (station,))
        writer.commit()
        reader.close()
        writer.close()


@needs_db
def test_session_timezone_is_utc():
    conn = serve.db_connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT @@session.time_zone")
            assert cur.fetchone()[0] == "+00:00"
    finally:
        conn.close()
