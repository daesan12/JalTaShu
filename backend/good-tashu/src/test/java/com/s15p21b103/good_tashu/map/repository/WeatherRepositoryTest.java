package com.s15p21b103.good_tashu.map.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WeatherRepositoryTest {
    private static final String KEY = "tashu:weather:latest:v1";

    private final RedisTemplate<String, String> redis = mock(RedisTemplate.class);
    private final ValueOperations<String, String> values = mock(ValueOperations.class);
    private WeatherRepository repository;

    @BeforeEach
    void setUp() {
        when(redis.opsForValue()).thenReturn(values);
        repository = new WeatherRepository(redis, new ObjectMapper(), KEY);
    }

    @Test
    void readsLatestWeather() {
        when(values.get(KEY)).thenReturn("""
                {
                  "schema_version": 1,
                  "observed_at": "2026-09-20T14:00:00+09:00",
                  "fetched_at": "2026-09-20T14:41:12+09:00",
                  "nx": 67,
                  "ny": 100,
                  "temperature": 24.3,
                  "rainfall_1h": 0.0,
                  "source": "KMA_GET_ULTRA_SRT_NCST"
                }
                """);

        var result = repository.findLatest();

        assertThat(result.observedAt().toString()).isEqualTo("2026-09-20T14:00+09:00");
        assertThat(result.temperature()).isEqualByComparingTo("24.3");
        assertThat(result.rainfall1h()).isEqualByComparingTo("0.0");
    }

    @Test
    void returnsNullWhenKeyDoesNotExist() {
        when(values.get(KEY)).thenReturn(null);

        assertThat(repository.findLatest()).isNull();
    }

    @Test
    void returnsNullWhenJsonIsInvalid() {
        when(values.get(KEY)).thenReturn("not-json");

        assertThat(repository.findLatest()).isNull();
    }

    @Test
    void returnsNullWhenRedisIsUnavailable() {
        when(values.get(KEY)).thenThrow(new RedisConnectionFailureException("unavailable"));

        assertThat(repository.findLatest()).isNull();
    }
}
