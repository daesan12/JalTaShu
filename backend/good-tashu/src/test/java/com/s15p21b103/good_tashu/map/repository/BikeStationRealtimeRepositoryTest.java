package com.s15p21b103.good_tashu.map.repository;

import com.s15p21b103.good_tashu.cycle.domain.StationEntity;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.HashOperations;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class BikeStationRealtimeRepositoryTest {
    @SuppressWarnings("unchecked")
    private final RedisTemplate<String, String> redis = mock(RedisTemplate.class);
    @SuppressWarnings("unchecked")
    private final ValueOperations<String, String> values = mock(ValueOperations.class);
    @SuppressWarnings("unchecked")
    private final HashOperations<String, Object, Object> hashes = mock(HashOperations.class);

    private StationEntity master() {
        return StationEntity.builder().stationId("ST0001").name("마스터 이름")
                .latitude(new BigDecimal("36.35")).longitude(new BigDecimal("127.38")).build();
    }

    @Test
    void readsCollectorSnapshotContract() {
        when(redis.opsForValue()).thenReturn(values);
        when(values.get("tashu:station-availability:latest:v1")).thenReturn("""
                {"schema_version":1,"snapshot_id":"snapshot-1","station_count":1,
                 "stations":[{"station_id":"ST0001","bikes":7,
                              "collected_at":"2026-09-18T12:30:00+09:00"}]}
                """);
        var repository = new BikeStationRealtimeRepository(redis, new ObjectMapper(),
                "unused:{stationId}", "tashu:station-availability:latest:v1", "last-known");

        var result = repository.findAll(List.of(master())).get("ST0001");

        assertThat(result.currentCnt()).isEqualTo(7);
        assertThat(result.time()).isEqualTo("2026-09-18T12:30:00+09:00");
        assertThat(result.latitude()).isEqualByComparingTo("36.35");
        verify(values, never()).multiGet(anyList());
    }

    @Test
    void readsPerStationJsonAndUsesRedisSaveTime() {
        when(redis.opsForValue()).thenReturn(values);
        when(values.multiGet(List.of("live:ST0001"))).thenReturn(List.of("""
                {"stationId":"ST0001","name":"실시간 이름","nameEn":"Station",
                 "nameCn":"站","xPos":127.39,"yPos":36.36,"parkingCnt":7,
                 "time":"2026-09-18T12:30:00+09:00"}
                """));
        var repository = new BikeStationRealtimeRepository(redis, new ObjectMapper(),
                "live:{stationId}", "", "last-known");

        var result = repository.findAll(List.of(master())).get("ST0001");

        assertThat(result.name()).isEqualTo("실시간 이름");
        assertThat(result.nameEn()).isEqualTo("Station");
        assertThat(result.parkingCnt()).isEqualTo(7);
        assertThat(result.currentCnt()).isEqualTo(7);
        assertThat(result.time()).isEqualTo("2026-09-18T12:30:00+09:00");
    }

    @Test
    void readsSnapshotArrayWithCommonSaveTime() {
        when(redis.opsForValue()).thenReturn(values);
        when(values.get("live:snapshot")).thenReturn("""
                {"time":"2026-09-18T12:30:00+09:00","stations":[
                  {"stationId":"ST0001","parkingCnt":3}
                ]}
                """);
        var repository = new BikeStationRealtimeRepository(redis, new ObjectMapper(),
                "unused:{stationId}", "live:snapshot", "last-known");

        var result = repository.findAll(List.of(master())).get("ST0001");

        assertThat(result.currentCnt()).isEqualTo(3);
        assertThat(result.time()).isEqualTo("2026-09-18T12:30:00+09:00");
        assertThat(result.latitude()).isEqualByComparingTo("36.35");
    }

    @Test
    void readsApiResponseBodyItemsWhenSnapshotIsWrapped() {
        when(redis.opsForValue()).thenReturn(values);
        when(values.get("live:snapshot")).thenReturn("""
                {"savedAt":"2026-09-18T12:30:00+09:00","response":{"body":{"items":{"item":[
                  {"rntstnId":"ST0001","rntstnNm":"API 이름","bcyclTpkctNocs":"5",
                   "lat":"36.36","lot":"127.39"}
                ]}}}}
                """);
        var repository = new BikeStationRealtimeRepository(redis, new ObjectMapper(),
                "unused:{stationId}", "live:snapshot", "last-known");

        var result = repository.findAll(List.of(master())).get("ST0001");

        assertThat(result.name()).isEqualTo("API 이름");
        assertThat(result.currentCnt()).isEqualTo(5);
        assertThat(result.time()).isEqualTo("2026-09-18T12:30:00+09:00");
    }

    @Test
    void usesLastKnownValueWhenLatestSnapshotHasExpired() {
        when(redis.opsForValue()).thenReturn(values);
        when(redis.opsForHash()).thenReturn(hashes);
        when(hashes.multiGet("last-known", List.of("ST0001"))).thenReturn(List.of(
                "{\"bikes\":7,\"collected_at\":\"2026-09-18T12:30:00+09:00\"}"));
        var repository = new BikeStationRealtimeRepository(redis, new ObjectMapper(),
                "unused:{stationId}", "live:snapshot", "last-known");

        var result = repository.findAll(List.of(master())).get("ST0001");

        assertThat(result.currentCnt()).isEqualTo(7);
        assertThat(result.time()).isEqualTo("2026-09-18T12:30:00+09:00");
        assertThat(result.name()).isEqualTo("마스터 이름");
    }

    @Test
    void keepsFreshSnapshotValueWithoutReadingLastKnownValue() {
        when(redis.opsForValue()).thenReturn(values);
        when(values.get("live:snapshot")).thenReturn("""
                {"stations":[{"station_id":"ST0001","bikes":8,
                              "collected_at":"2026-09-18T12:31:00+09:00"}]}
                """);
        var repository = new BikeStationRealtimeRepository(redis, new ObjectMapper(),
                "unused:{stationId}", "live:snapshot", "last-known");

        assertThat(repository.findAll(List.of(master())).get("ST0001").currentCnt()).isEqualTo(8);
        verify(redis, never()).opsForHash();
    }

    @Test
    void fillsOnlyStationMissingFromLatestSnapshot() {
        StationEntity second = StationEntity.builder().stationId("ST0002").name("두 번째")
                .latitude(new BigDecimal("36.36")).longitude(new BigDecimal("127.39")).build();
        when(redis.opsForValue()).thenReturn(values);
        when(redis.opsForHash()).thenReturn(hashes);
        when(values.get("live:snapshot")).thenReturn("""
                {"stations":[{"station_id":"ST0001","bikes":8,
                              "collected_at":"2026-09-18T12:31:00+09:00"}]}
                """);
        when(hashes.multiGet("last-known", List.of("ST0002"))).thenReturn(List.of(
                "{\"bikes\":3,\"collected_at\":\"2026-09-18T12:30:00+09:00\"}"));
        var repository = new BikeStationRealtimeRepository(redis, new ObjectMapper(),
                "unused:{stationId}", "live:snapshot", "last-known");

        var result = repository.findAll(List.of(master(), second));

        assertThat(result.get("ST0001").currentCnt()).isEqualTo(8);
        assertThat(result.get("ST0002").currentCnt()).isEqualTo(3);
        assertThat(result.get("ST0002").time()).isEqualTo("2026-09-18T12:30:00+09:00");
    }
}
