from __future__ import annotations

import importlib.util
import pathlib
import sys
import unittest
from types import SimpleNamespace


MODULE_PATH = (
    pathlib.Path(__file__).parents[1] / "jobs" / "kafka_mysql_streaming.py"
)
SPEC = importlib.util.spec_from_file_location("kafka_mysql_streaming", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def base_env() -> dict[str, str]:
    return {
        "TASHU_DATA_DB_JDBC_URL": "jdbc:mysql://db:3306/tashu_data",
        "TASHU_DATA_DB_USER": "writer",
        "TASHU_DATA_DB_PASSWORD": "secret",
        "TASHU_DATA_DB_DRIVER": "com.mysql.cj.jdbc.Driver",
    }


class SettingsTest(unittest.TestCase):
    def test_operational_defaults_match_contract(self):
        settings = MODULE.load_settings(base_env())
        self.assertEqual(settings.kafka_bootstrap_servers, "172.26.4.110:9092")
        self.assertEqual(settings.station_topic, "tashu.station-availability.v1")
        self.assertEqual(settings.weather_topic, "tashu.weather-observation.v1")
        self.assertEqual(settings.starting_offsets, "earliest")
        self.assertEqual(settings.trigger_seconds, 10)

    def test_missing_secret_environment_fails(self):
        env = base_env()
        del env["TASHU_DATA_DB_PASSWORD"]
        with self.assertRaisesRegex(RuntimeError, "TASHU_DATA_DB_PASSWORD"):
            MODULE.load_settings(env)

    def test_invalid_starting_offsets_fails(self):
        env = base_env()
        env["TASHU_STREAM_STARTING_OFFSETS"] = "middle"
        with self.assertRaisesRegex(RuntimeError, "earliest or latest"):
            MODULE.load_settings(env)

    def test_non_positive_trigger_fails(self):
        env = base_env()
        env["TASHU_STREAM_TRIGGER_SECONDS"] = "0"
        with self.assertRaisesRegex(RuntimeError, "greater than zero"):
            MODULE.load_settings(env)


class SqlContractTest(unittest.TestCase):
    def test_station_upsert_is_parameterized_and_idempotent(self):
        sql = MODULE.mysql_insert_sql(MODULE.STATION_TABLE, MODULE.STATION_COLUMNS)
        self.assertEqual(sql.count("?"), len(MODULE.STATION_COLUMNS))
        self.assertIn("ON DUPLICATE KEY UPDATE", sql)
        self.assertIn("`event_id`", sql)
        self.assertNotIn("secret", sql)

    def test_weather_upsert_is_parameterized_and_idempotent(self):
        sql = MODULE.mysql_insert_sql(MODULE.WEATHER_TABLE, MODULE.WEATHER_COLUMNS)
        self.assertEqual(sql.count("?"), len(MODULE.WEATHER_COLUMNS))
        self.assertIn("ON DUPLICATE KEY UPDATE", sql)

    def test_unsafe_identifier_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "unsafe"):
            MODULE.mysql_insert_sql("weather_observation; DROP TABLE x", ("event_id",))

    def test_micro_batch_is_committed_in_bounded_jdbc_batches(self):
        class FakePreparedStatement:
            def __init__(self):
                self.pending = 0
                self.executed_sizes = []
                self.closed = False

            def setLong(self, *_args):
                pass

            def setString(self, *_args):
                pass

            def addBatch(self):
                self.pending += 1

            def executeBatch(self):
                self.executed_sizes.append(self.pending)

            def clearBatch(self):
                self.pending = 0

            def close(self):
                self.closed = True

        class FakeTimezoneStatement:
            def execute(self, sql):
                self.sql = sql

            def close(self):
                pass

        class FakeConnection:
            def __init__(self):
                self.prepared = FakePreparedStatement()
                self.commits = 0
                self.rollbacks = 0
                self.closed = False

            def setAutoCommit(self, value):
                self.auto_commit = value

            def createStatement(self):
                return FakeTimezoneStatement()

            def prepareStatement(self, sql):
                self.sql = sql
                return self.prepared

            def commit(self):
                self.commits += 1

            def rollback(self):
                self.rollbacks += 1

            def close(self):
                self.closed = True

        connection = FakeConnection()
        fake_jvm = SimpleNamespace(
            java=SimpleNamespace(
                lang=SimpleNamespace(
                    Class=SimpleNamespace(forName=lambda _driver: None)
                ),
                sql=SimpleNamespace(
                    DriverManager=SimpleNamespace(
                        getConnection=lambda *_args: connection
                    )
                ),
            )
        )
        settings = MODULE.load_settings(base_env())
        rows = [
            {"event_id": "event-1", "schema_version": 1},
            {"event_id": "event-2", "schema_version": 1},
            {"event_id": "event-3", "schema_version": 1},
        ]

        written = MODULE.execute_mysql_upsert(
            rows,
            columns=("event_id", "schema_version"),
            table="events",
            settings=settings,
            jvm=fake_jvm,
            batch_size=2,
        )

        self.assertEqual(written, 3)
        self.assertEqual(connection.prepared.executed_sizes, [2, 1])
        self.assertEqual(connection.commits, 1)
        self.assertEqual(connection.rollbacks, 0)
        self.assertTrue(connection.closed)


if __name__ == "__main__":
    unittest.main()
