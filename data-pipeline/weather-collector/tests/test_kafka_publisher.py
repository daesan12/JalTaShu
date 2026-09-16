import json
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from kafka_publisher import (
    WeatherKafkaError,
    WeatherKafkaOutbox,
    WeatherKafkaPublisher,
    message_for_observation,
)


class Observation:
    observed_at = datetime.fromisoformat("2026-09-16T09:00:00+09:00")
    fetched_at = datetime.fromisoformat("2026-09-16T10:26:10+09:00")
    nx = 67
    ny = 100
    temperature = 20.6
    rainfall_1h = 0.0
    source = "KMA_GET_ULTRA_SRT_NCST"


class FakeProducer:
    def __init__(self, *, fail=False):
        self.fail = fail
        self.messages = []

    def produce(self, topic, *, key, value, on_delivery):
        self.messages.append((topic, key, value))
        if self.fail:
            on_delivery("broker unavailable", None)
        else:
            on_delivery(None, None)

    def poll(self, _timeout):
        return 0

    def flush(self, _timeout):
        return 0


class WeatherKafkaPublisherTest(unittest.TestCase):
    def publisher(self, producer):
        return WeatherKafkaPublisher(producer=producer)

    def test_message_contract(self):
        key, raw = message_for_observation(Observation())
        value = json.loads(raw)

        self.assertEqual(key, b"67:100")
        self.assertEqual(value["schema_version"], 1)
        self.assertEqual(
            value["event_id"], "2026-09-16T09:00:00+09:00:67:100"
        )
        self.assertEqual(value["temperature"], 20.6)
        self.assertEqual(value["rainfall_1h"], 0.0)
        self.assertNotIn("api_key", value)

    def test_naive_observation_time_is_rejected(self):
        observation = Observation()
        observation.observed_at = datetime(2026, 9, 16, 9, 0)
        with self.assertRaises(WeatherKafkaError):
            message_for_observation(observation)

    def test_outbox_persists_then_replays(self):
        producer = FakeProducer()
        publisher = self.publisher(producer)
        with tempfile.TemporaryDirectory() as temp_dir:
            outbox = WeatherKafkaOutbox(publisher, temp_dir)
            path = outbox.enqueue(Observation())

            self.assertTrue(path.exists())
            self.assertEqual(outbox.pending_count(), 1)
            result = outbox.replay_pending()

            self.assertEqual(result.delivered_events, 1)
            self.assertEqual(result.pending_events, 0)
            self.assertFalse(path.exists())
            self.assertEqual(producer.messages[0][0], "tashu.weather-observation.v1")

    def test_failed_replay_keeps_spool_file(self):
        producer = FakeProducer(fail=True)
        publisher = self.publisher(producer)
        with tempfile.TemporaryDirectory() as temp_dir:
            outbox = WeatherKafkaOutbox(publisher, temp_dir)
            path = outbox.enqueue(Observation())

            with self.assertRaises(WeatherKafkaError):
                outbox.replay_pending()

            self.assertTrue(path.exists())
            self.assertEqual(outbox.pending_count(), 1)


if __name__ == "__main__":
    unittest.main()
