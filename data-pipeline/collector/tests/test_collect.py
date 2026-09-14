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
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


def item(station_id):
    return {
        "rntstnId": str(station_id),
        "rntstnNm": f"station-{station_id}",
        "lat": "36.35",
        "lot": "127.38",
        "bcyclTpkctNocs": "3",
    }


def response(items, total_count, code="K0", message="test-message"):
    return FakeResponse(
        {
            "header": {"resultCode": code, "resultMsg": message},
            "body": {"totalCount": total_count, "item": items},
        }
    )


class CollectorTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.old_paths = (
            collect.DATA_ROOT,
            collect.SNAPSHOT_ROOT,
            collect.CSV_ROOT,
            collect.STATE_DIR,
            collect.STATE_PATH,
            collect.HEALTH_PATH,
        )
        collect.DATA_ROOT = self.root / "data"
        collect.SNAPSHOT_ROOT = collect.DATA_ROOT / "snapshots"
        collect.CSV_ROOT = collect.DATA_ROOT / "csv"
        collect.STATE_DIR = collect.DATA_ROOT / "state"
        collect.STATE_PATH = collect.STATE_DIR / "collector_state.json"
        collect.HEALTH_PATH = self.root / "health.json"
        self.env = mock.patch.dict(
            os.environ,
            {"TASHU_API_KEY": "primary-test-key", "TASHU_WRITE_CSV": "false"},
            clear=False,
        )
        self.env.start()
        os.environ.pop("TASHU_API_KEY_FALLBACK", None)
        os.environ.pop("TASHU_INTERVAL_SECONDS", None)
        os.environ.pop("TASHU_KAFKA_ENABLED", None)

    def tearDown(self):
        self.env.stop()
        (
            collect.DATA_ROOT,
            collect.SNAPSHOT_ROOT,
            collect.CSV_ROOT,
            collect.STATE_DIR,
            collect.STATE_PATH,
            collect.HEALTH_PATH,
        ) = self.old_paths
        self.temp_dir.cleanup()

    def new_collector(self):
        collector = collect.Collector()
        self.addCleanup(collector.session.close)
        return collector

    def test_two_pages_form_one_complete_snapshot(self):
        collector = self.new_collector()
        page_one = [item(index) for index in range(1000)]
        collector.session.get = mock.Mock(
            side_effect=[response(page_one, 1001), response([item(1000)], 1001)]
        )

        frame = collector.fetch_snapshot()

        self.assertEqual(len(frame), 1001)
        self.assertEqual(frame["station_id"].nunique(), 1001)
        self.assertEqual(collector.session.get.call_count, 2)
        params = collector.session.get.call_args_list[0].kwargs["params"]
        self.assertEqual(params["numOfRows"], 1000)
        self.assertEqual(params["lcgvmnInstCd"], "3000000000")

    @mock.patch.object(collect, "_backoff_sleep", return_value=None)
    def test_duplicate_station_retries_whole_snapshot(self, _sleep):
        collector = self.new_collector()
        first_page = [item(index) for index in range(1000)]
        collector.session.get = mock.Mock(
            side_effect=[
                response(first_page, 1001),
                response([item(999)], 1001),
                response(first_page, 1001),
                response([item(1000)], 1001),
            ]
        )

        frame = collector.fetch_snapshot()

        self.assertEqual(frame["station_id"].nunique(), 1001)
        self.assertEqual(collector.session.get.call_count, 4)

    @mock.patch.object(collect, "_backoff_sleep", return_value=None)
    def test_page_request_retries_after_transient_http_failure(self, _sleep):
        collector = self.new_collector()
        collector.session.get = mock.Mock(
            side_effect=[collect.requests.ConnectionError("temporary"), response([item(1)], 1)]
        )

        frame = collector.fetch_snapshot()

        self.assertEqual(len(frame), 1)
        self.assertEqual(collector.session.get.call_count, 2)

    def test_k10_is_not_retried_without_fallback(self):
        collector = self.new_collector()
        collector.session.get = mock.Mock(return_value=response([], 0, code="K10"))

        with self.assertRaises(collect.ApiError):
            collector.fetch_snapshot()

        self.assertEqual(collector.session.get.call_count, 1)

    def test_api_key_is_redacted_from_api_error_logs(self):
        collector = self.new_collector()
        collector.session.get = mock.Mock(
            return_value=response([], 0, code="K10", message="bad primary-test-key")
        )

        with self.assertLogs(level="WARNING") as captured, self.assertRaises(collect.ApiError):
            collector.fetch_snapshot()

        self.assertNotIn("primary-test-key", "\n".join(captured.output))
        self.assertIn("[redacted]", "\n".join(captured.output))

    def test_k10_switches_to_fallback_key(self):
        os.environ["TASHU_API_KEY_FALLBACK"] = "fallback-test-key"
        collector = self.new_collector()
        collector.session.get = mock.Mock(
            side_effect=[response([], 0, code="K10"), response([item(1)], 1)]
        )

        frame = collector.fetch_snapshot()

        self.assertEqual(len(frame), 1)
        calls = collector.session.get.call_args_list
        self.assertEqual(calls[0].kwargs["params"]["serviceKey"], "primary-test-key")
        self.assertEqual(calls[1].kwargs["params"]["serviceKey"], "fallback-test-key")

    def test_daily_limit_is_tracked_per_key_and_uses_fallback(self):
        os.environ["TASHU_API_KEY_FALLBACK"] = "fallback-test-key"
        collector = self.new_collector()
        today = datetime.now(collect.KST).date().isoformat()
        collector.state["calls"][today] = {"primary": collect.DAILY_CALL_LIMIT}
        collector._save_state()
        collector.session.get = mock.Mock(return_value=response([item(1)], 1))

        frame = collector.fetch_snapshot()

        self.assertEqual(len(frame), 1)
        self.assertEqual(collector.session.get.call_count, 1)
        params = collector.session.get.call_args.kwargs["params"]
        self.assertEqual(params["serviceKey"], "fallback-test-key")
        self.assertEqual(collector.state["calls"][today]["fallback"], 1)

    def test_default_interval_is_45_seconds(self):
        self.assertEqual(collect.INTERVAL_SECONDS, 45)
        self.assertEqual(self.new_collector().interval_seconds, 45)

    def test_interval_environment_override(self):
        os.environ["TASHU_INTERVAL_SECONDS"] = "60"
        self.assertEqual(self.new_collector().interval_seconds, 60)

    def _buffer_one_row(self, collector):
        collected_at = datetime.now(collect.KST)
        collector.buffer.append(collector.normalize_snapshot(collected_at, [item(1)]))
        return collected_at

    def test_parquet_and_health_are_written_when_csv_disabled(self):
        collector = self.new_collector()
        collected_at = self._buffer_one_row(collector)
        collector._update_health(collected_at, 1)

        self.assertEqual(collector.flush(), 1)

        self.assertEqual(len(list(collect.SNAPSHOT_ROOT.rglob("*.parquet"))), 1)
        self.assertEqual(len(list(collect.CSV_ROOT.rglob("*.csv"))), 0)
        self.assertTrue(collect.HEALTH_PATH.exists())

    def test_csv_is_written_when_enabled(self):
        os.environ["TASHU_WRITE_CSV"] = "true"
        collector = self.new_collector()
        self._buffer_one_row(collector)

        collector.flush()

        self.assertEqual(len(list(collect.SNAPSHOT_ROOT.rglob("*.parquet"))), 1)
        self.assertEqual(len(list(collect.CSV_ROOT.rglob("*.csv"))), 1)

    def test_close_flushes_remaining_buffer(self):
        collector = self.new_collector()
        self._buffer_one_row(collector)

        collector.close(normal=False)

        self.assertFalse(collector.buffer)
        self.assertEqual(len(list(collect.SNAPSHOT_ROOT.rglob("*.parquet"))), 1)


if __name__ == "__main__":
    unittest.main()
