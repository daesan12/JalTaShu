#!/usr/bin/env python3
"""Publish a two-station snapshot to a local Kafka broker for manual verification."""

from __future__ import annotations

import os
import uuid
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd

from kafka_publisher import KafkaOutbox, KafkaPublisher


def main() -> int:
    snapshot_id = f"local-smoke-{uuid.uuid4()}"
    collected_at = datetime.now(ZoneInfo("Asia/Seoul"))
    frame = pd.DataFrame(
        [
            {
                "collected_at": collected_at,
                "station_id": "LOCAL-STATION-001",
                "station_name": "로컬 테스트 대여소 1",
                "lat": 36.35,
                "lon": 127.38,
                "bikes": 7,
            },
            {
                "collected_at": collected_at,
                "station_id": "LOCAL-STATION-002",
                "station_name": "로컬 테스트 대여소 2",
                "lat": 36.36,
                "lon": 127.39,
                "bikes": 3,
            },
        ]
    )
    spool_dir = Path(
        os.environ.get("TASHU_KAFKA_SPOOL_DIR", "").strip()
        or "data/kafka-smoke-spool"
    )
    outbox = KafkaOutbox(KafkaPublisher.from_env(), spool_dir)
    try:
        outbox.enqueue_snapshot(frame, snapshot_id)
        result = outbox.replay_pending()
    finally:
        outbox.close()

    print(
        f"Kafka smoke test OK: snapshot_id={snapshot_id} "
        f"messages={result.delivered_messages} pending={result.pending_snapshots}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
