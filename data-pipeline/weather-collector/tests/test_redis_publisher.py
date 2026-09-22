import json
import os
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest import mock

import redis

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from redis_publisher import (
    DEFAULT_KEY,
    WeatherRedisPublisher,
    WeatherRedisPublishError,
    payload_for_observation,
)


class Observation:
    observed_at = datetime.fromisoformat("2026-09-20T14:00:00+09:00")
    fetched_at = datetime.fromisoformat("2026-09-20T14:41:12+09:00")
    nx = 67
    ny = 100
    temperature = 24.3
    rainfall_1h = 0.0
    source = "KMA_GET_ULTRA_SRT_NCST"


class WeatherRedisPublisherTest(unittest.TestCase):
    def test_payload_matches_backend_contract(self):
        payload = json.loads(payload_for_observation(Observation()))

        self.assertEqual(
            payload,
            {
                "schema_version": 1,
                "observed_at": "2026-09-20T14:00:00+09:00",
                "fetched_at": "2026-09-20T14:41:12+09:00",
                "nx": 67,
                "ny": 100,
                "temperature": 24.3,
                "rainfall_1h": 0.0,
                "source": "KMA_GET_ULTRA_SRT_NCST",
            },
        )

    def test_set_uses_latest_key_and_ttl(self):
        client = mock.Mock()
        client.set.return_value = True
        publisher = WeatherRedisPublisher(client, DEFAULT_KEY, 3600)

        publisher.publish(Observation())

        client.set.assert_called_once()
        key, raw = client.set.call_args.args
        self.assertEqual(key, DEFAULT_KEY)
        self.assertEqual(client.set.call_args.kwargs, {"ex": 3600})
        self.assertEqual(json.loads(raw)["observed_at"], "2026-09-20T14:00:00+09:00")

    def test_naive_time_is_rejected_before_writing(self):
        observation = Observation()
        observation.observed_at = datetime(2026, 9, 20, 14, 0)
        client = mock.Mock()
        publisher = WeatherRedisPublisher(client)

        with self.assertRaisesRegex(WeatherRedisPublishError, "timezone"):
            publisher.publish(observation)

        client.set.assert_not_called()

    def test_redis_error_is_wrapped_without_credentials(self):
        client = mock.Mock()
        client.set.side_effect = redis.ConnectionError("redis://secret@example")
        publisher = WeatherRedisPublisher(client)

        with self.assertRaisesRegex(WeatherRedisPublishError, "publish failed") as raised:
            publisher.publish(Observation())

        self.assertNotIn("secret", str(raised.exception))

    @mock.patch("redis_publisher.redis.Redis")
    def test_from_env_uses_station_redis_connection_contract(self, redis_client):
        with mock.patch.dict(
            os.environ,
            {
                "WEATHER_REDIS_HOST": "10.0.0.15",
                "WEATHER_REDIS_PORT": "6380",
                "WEATHER_REDIS_DATABASE": "0",
                "WEATHER_REDIS_PASSWORD": "server-secret",
                "WEATHER_REDIS_LATEST_KEY": "tashu:weather:latest:v1",
                "WEATHER_REDIS_TTL_SECONDS": "3600",
            },
        ):
            publisher = WeatherRedisPublisher.from_env()

        redis_client.assert_called_once_with(
            host="10.0.0.15",
            port=6380,
            db=0,
            password="server-secret",
            socket_connect_timeout=2,
            socket_timeout=2,
            decode_responses=True,
        )
        self.assertEqual(publisher.key, DEFAULT_KEY)
        self.assertEqual(publisher.ttl_seconds, 3600)


if __name__ == "__main__":
    unittest.main()
