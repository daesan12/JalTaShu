import json
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest import mock

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from redis_publisher import DEFAULT_KEY, DEFAULT_LAST_KNOWN_KEY, RedisPublishError, RedisSnapshotPublisher


class RedisSnapshotPublisherTest(unittest.TestCase):
    def frame(self):
        return pd.DataFrame(
            [
                {
                    "collected_at": datetime.fromisoformat("2026-09-18T10:00:00+09:00"),
                    "station_id": "ST0001",
                    "station_name": "시청역",
                    "lat": 36.35,
                    "lon": 127.38,
                    "bikes": 7,
                }
            ]
        )

    def test_publishes_requested_station_fields_in_one_atomic_value_with_ttl(self):
        client = mock.MagicMock()
        pipe = client.pipeline.return_value.__enter__.return_value
        pipe.execute.return_value = [True, 1]
        publisher = RedisSnapshotPublisher(client, DEFAULT_KEY, 180)

        publisher.publish(self.frame(), "snapshot-1")

        client.pipeline.assert_called_once_with(transaction=True)
        pipe.set.assert_called_once()
        key, raw = pipe.set.call_args.args
        self.assertEqual(key, DEFAULT_KEY)
        self.assertEqual(pipe.set.call_args.kwargs, {"ex": 180})
        self.assertEqual(
            json.loads(pipe.hset.call_args.kwargs["mapping"]["ST0001"]),
            {"bikes": 7, "collected_at": "2026-09-18T10:00:00+09:00"},
        )
        self.assertEqual(pipe.hset.call_args.args, (DEFAULT_LAST_KNOWN_KEY,))
        payload = json.loads(raw)
        self.assertEqual(payload["schema_version"], 1)
        self.assertEqual(payload["snapshot_id"], "snapshot-1")
        self.assertEqual(payload["station_count"], 1)
        self.assertEqual(
            payload["stations"][0],
            {
                "station_id": "ST0001",
                "bikes": 7,
                "collected_at": "2026-09-18T10:00:00+09:00",
            },
        )

    def test_rejects_duplicate_station_ids_before_writing(self):
        client = mock.Mock()
        frame = pd.concat([self.frame(), self.frame()], ignore_index=True)
        publisher = RedisSnapshotPublisher(client, DEFAULT_KEY, 180)

        with self.assertRaisesRegex(RedisPublishError, "duplicate station_id"):
            publisher.publish(frame, "snapshot-1")

        client.pipeline.assert_not_called()

    def test_rejects_naive_collected_at_before_writing(self):
        client = mock.Mock()
        frame = self.frame()
        frame["collected_at"] = datetime(2026, 9, 18, 10, 0)
        publisher = RedisSnapshotPublisher(client, DEFAULT_KEY, 180)

        with self.assertRaisesRegex(RedisPublishError, "timezone-aware"):
            publisher.publish(frame, "snapshot-1")

        client.pipeline.assert_not_called()

    def test_wraps_redis_failures_without_exposing_credentials(self):
        import redis

        client = mock.MagicMock()
        client.pipeline.return_value.__enter__.return_value.execute.side_effect = redis.ConnectionError("redis://secret@example")
        publisher = RedisSnapshotPublisher(client, DEFAULT_KEY, 180)

        with self.assertRaisesRegex(RedisPublishError, "publish failed") as raised:
            publisher.publish(self.frame(), "snapshot-1")

        self.assertNotIn("secret", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
