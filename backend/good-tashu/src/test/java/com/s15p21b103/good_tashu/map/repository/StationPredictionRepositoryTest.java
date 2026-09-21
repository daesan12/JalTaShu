package com.s15p21b103.good_tashu.map.repository;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class StationPredictionRepositoryTest {
    @Test
    void returnsOnlyPresentFutureKeysUsingEachPredictionTimestamp() {
        @SuppressWarnings("unchecked")
        RedisTemplate<String, String> redis = mock(RedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        OffsetDateTime updatedAt = OffsetDateTime.now(ZoneOffset.UTC).minusSeconds(20);
        List<String> payloads = new ArrayList<>(java.util.Collections.nCopies(60, null));
        payloads.set(0, """
                {"bikes":3.2,"prob_out":0.125,"updated_at":"%s"}
                """.formatted(updatedAt));
        payloads.set(59, """
                {"bikes":1.0,"prob_out":0.8,"updated_at":"%s"}
                """.formatted(updatedAt));
        when(values.multiGet(anyList())).thenReturn(payloads);

        var result = new StationPredictionRepository(redis, new ObjectMapper())
                .findNext60Minutes("ST0001");

        assertThat(result).hasSize(2);
        assertThat(result.getFirst().dateTime()).isEqualTo(updatedAt.plusMinutes(1));
        assertThat(result.getLast().dateTime()).isEqualTo(updatedAt.plusMinutes(60));
        assertThat(result.getFirst().bikeCnt()).isEqualByComparingTo("3.2");
        assertThat(result.getFirst().probOut()).isEqualByComparingTo("0.125");
    }

    @Test
    void returnsBikeCountForRequestedArrivalMinute() {
        @SuppressWarnings("unchecked")
        RedisTemplate<String, String> redis = mock(RedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        OffsetDateTime updatedAt = OffsetDateTime.now(ZoneOffset.UTC).minusSeconds(10);
        when(values.get("pred:ST0001:3")).thenReturn("""
                {"bikes":4.2,"prob_out":0.2,"updated_at":"%s"}
                """.formatted(updatedAt));

        var result = new StationPredictionRepository(redis, new ObjectMapper())
                .findBikeCount("ST0001", 3);

        assertThat(result).isEqualByComparingTo("4.2");
    }

    @Test
    void returnsNullWithoutReadingRedisWhenArrivalExceedsPredictionRange() {
        @SuppressWarnings("unchecked")
        RedisTemplate<String, String> redis = mock(RedisTemplate.class);

        assertThat(new StationPredictionRepository(redis, new ObjectMapper())
                .findBikeCount("ST0001", 61)).isNull();
        verifyNoInteractions(redis);
    }
}
