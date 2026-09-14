import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from kafka_publisher import KafkaOutbox, KafkaPublishError, KafkaPublisher


class FakeProducer:
    def __init__(self):
        self.messages = []

    def produce(self, topic, *, key, value, on_delivery):
        self.messages.append((topic, key, value))
        on_delivery(None, None)

    def poll(self, _timeout):
        return 0

    def flush(self, _timeout):
        return 0


class FakeFrame:
    def __init__(self, records):
        self.records = records
        self.columns = tuple(records[0]) if records else ()

    def to_dict(self, *, orient):
        if orient != "records":
            raise ValueError("FakeFrame only supports records orientation")
        return [record.copy() for record in self.records]


class KafkaPublisherTest(unittest.TestCase):
    def frame(self):
        collected_at = datetime(
            2026, 9, 10, 15, 0, tzinfo=timezone(timedelta(hours=9))
        )
        return FakeFrame(
            [
                {
                    "collected_at": collected_at,
                    "station_id": "STATION-001",
                    "station_name": "테스트 대여소 1",
                    "lat": 36.35,
                    "lon": 127.38,
                    "bikes": 7,
                },
                {
                    "collected_at": collected_at,
                    "station_id": "STATION-002",
                    "station_name": "테스트 대여소 2",
                    "lat": 36.36,
                    "lon": 127.39,
                    "bikes": 3,
                },
            ]
        )

    def test_one_message_per_station_with_shared_snapshot_id(self):
        producer = FakeProducer()
        publisher = KafkaPublisher(producer=producer)

        result = publisher.publish_snapshot(self.frame(), snapshot_id="snapshot-test")

        self.assertEqual(result.message_count, 2)
        self.assertEqual(len(producer.messages), 2)
        values = []
        for topic, key, raw_value in producer.messages:
            self.assertEqual(topic, "tashu.station-availability.v1")
            values.append(json.loads(raw_value.decode("utf-8")))
            self.assertEqual(key.decode("utf-8"), values[-1]["station_id"])
            self.assertEqual(
                values[-1]["event_id"],
                f"snapshot-test:{values[-1]['station_id']}",
            )
        self.assertEqual({value["snapshot_id"] for value in values}, {"snapshot-test"})
        self.assertEqual({value["station_count"] for value in values}, {2})

    def test_duplicate_station_is_rejected_before_sending(self):
        producer = FakeProducer()
        publisher = KafkaPublisher(producer=producer)
        frame = self.frame()
        frame.records[1]["station_id"] = "STATION-001"

        with self.assertRaises(KafkaPublishError):
            publisher.publish_snapshot(frame)

        self.assertEqual(producer.messages, [])

    def test_outbox_persists_then_replays_snapshot(self):
        producer = FakeProducer()
        publisher = KafkaPublisher(producer=producer)
        with tempfile.TemporaryDirectory() as directory:
            outbox = KafkaOutbox(publisher, directory)

            path = outbox.enqueue_snapshot(self.frame(), "snapshot-spooled")

            self.assertTrue(path.exists())
            self.assertEqual(outbox.pending_count(), 1)
            self.assertEqual(producer.messages, [])

            result = outbox.replay_pending()

            self.assertEqual(result.delivered_snapshots, 1)
            self.assertEqual(result.delivered_messages, 2)
            self.assertEqual(result.pending_snapshots, 0)
            self.assertFalse(path.exists())
            self.assertEqual(len(producer.messages), 2)

    def test_failed_replay_keeps_spool_file(self):
        producer = FakeProducer()
        publisher = KafkaPublisher(producer=producer)
        with tempfile.TemporaryDirectory() as directory:
            outbox = KafkaOutbox(publisher, directory)
            path = outbox.enqueue_snapshot(self.frame(), "snapshot-retry")
            producer.flush = lambda _timeout: 2

            with self.assertRaises(KafkaPublishError):
                outbox.replay_pending()

            self.assertTrue(path.exists())
            self.assertEqual(outbox.pending_count(), 1)


if __name__ == "__main__":
    unittest.main()
