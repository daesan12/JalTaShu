import json
import os
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import collect


class FakeResponse:
    status_code = 200

    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


def payload(base_date="20260915", base_time="1400", temperature="27.1", rainfall="0"):
    return {
        "response": {
            "header": {"resultCode": "00", "resultMsg": "NORMAL_SERVICE"},
            "body": {
                "items": {
                    "item": [
                        {"baseDate": base_date, "baseTime": base_time, "category": "T1H", "obsrValue": temperature},
                        {"baseDate": base_date, "baseTime": base_time, "category": "RN1", "obsrValue": rainfall},
                        {"baseDate": base_date, "baseTime": base_time, "category": "WSD", "obsrValue": "1.2"},
                    ]
                }
            },
        }
    }


class WeatherCollectorTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.old_paths = (
            collect.DATA_ROOT,
            collect.OBSERVATION_ROOT,
            collect.HEALTH_PATH,
            collect.LATEST_PATH,
        )
        collect.DATA_ROOT = self.root / "data"
        collect.OBSERVATION_ROOT = collect.DATA_ROOT / "observations"
        collect.HEALTH_PATH = self.root / "health.json"
        collect.LATEST_PATH = collect.DATA_ROOT / "latest.json"
        self.env = mock.patch.dict(
            os.environ,
            {"KMA_API_KEY": "test-key", "WEATHER_KAFKA_ENABLED": "false"},
            clear=False,
        )
        self.env.start()

    def tearDown(self):
        self.env.stop()
        (
            collect.DATA_ROOT,
            collect.OBSERVATION_ROOT,
            collect.HEALTH_PATH,
            collect.LATEST_PATH,
        ) = self.old_paths
        self.temp_dir.cleanup()

    def new_collector(self):
        collector = collect.WeatherCollector()
        self.addCleanup(collector.close)
        return collector

    def test_available_time_before_release_uses_previous_hour(self):
        now = datetime(2026, 9, 15, 0, 39, tzinfo=collect.KST)
        self.assertEqual(
            collect.available_observation_time(now),
            datetime(2026, 9, 14, 23, 0, tzinfo=collect.KST),
        )

    def test_available_time_at_release_uses_current_hour(self):
        now = datetime(2026, 9, 15, 14, 40, tzinfo=collect.KST)
        self.assertEqual(
            collect.available_observation_time(now),
            datetime(2026, 9, 15, 14, 0, tzinfo=collect.KST),
        )

    def test_fetch_parses_t1h_and_rn1(self):
        collector = self.new_collector()
        collector.session.get = mock.Mock(return_value=FakeResponse(payload()))
        now = datetime(2026, 9, 15, 14, 45, tzinfo=collect.KST)

        observation = collector.fetch(now)

        self.assertEqual(observation.temperature, 27.1)
        self.assertEqual(observation.rainfall_1h, 0.0)
        params = collector.session.get.call_args.kwargs["params"]
        self.assertEqual(params["base_date"], "20260915")
        self.assertEqual(params["base_time"], "1400")
        self.assertEqual((params["nx"], params["ny"]), (67, 100))

    def test_korean_no_rain_is_zero(self):
        observation = collect.parse_observation(
            payload(rainfall="강수없음"),
            target=datetime(2026, 9, 15, 14, 0, tzinfo=collect.KST),
            fetched_at=datetime(2026, 9, 15, 14, 45, tzinfo=collect.KST),
            nx=67,
            ny=100,
        )
        self.assertEqual(observation.rainfall_1h, 0.0)

    def test_missing_required_category_fails(self):
        broken = payload()
        broken["response"]["body"]["items"]["item"] = broken["response"]["body"]["items"]["item"][:1]
        with self.assertRaises(collect.WeatherApiError):
            collect.parse_observation(
                broken,
                target=datetime(2026, 9, 15, 14, 0, tzinfo=collect.KST),
                fetched_at=datetime(2026, 9, 15, 14, 45, tzinfo=collect.KST),
                nx=67,
                ny=100,
            )

    def test_same_observation_is_saved_once(self):
        collector = self.new_collector()
        observation = collect.parse_observation(
            payload(),
            target=datetime(2026, 9, 15, 14, 0, tzinfo=collect.KST),
            fetched_at=datetime(2026, 9, 15, 14, 45, tzinfo=collect.KST),
            nx=67,
            ny=100,
        )

        first_path, first_created = collector.save(observation)
        second_path, second_created = collector.save(observation)

        self.assertEqual(first_path, second_path)
        self.assertTrue(first_created)
        self.assertFalse(second_created)
        self.assertEqual(len(list(collect.OBSERVATION_ROOT.rglob("*.parquet"))), 1)
        latest = json.loads(collect.LATEST_PATH.read_text(encoding="utf-8"))
        self.assertEqual(latest["temperature"], 27.1)

    def test_same_observation_is_enqueued_to_kafka_once(self):
        collector = self.new_collector()
        collector.kafka_enabled = True
        collector.kafka_outbox = mock.Mock()
        collector.kafka_outbox.pending_count.return_value = 0
        collector.kafka_outbox.replay_pending.return_value = mock.Mock(
            delivered_events=0, pending_events=0
        )
        collector.kafka_outbox.enqueue.return_value = self.root / "spool.json"
        collector.session.get = mock.Mock(return_value=FakeResponse(payload()))
        now = datetime(2026, 9, 15, 14, 45, tzinfo=collect.KST)

        collector.collect_once(now)
        collector.collect_once(now)

        collector.kafka_outbox.enqueue.assert_called_once()


if __name__ == "__main__":
    unittest.main()
