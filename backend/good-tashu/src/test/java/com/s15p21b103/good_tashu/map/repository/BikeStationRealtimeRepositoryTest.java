package com.s15p21b103.good_tashu.map.repository;

import com.s15p21b103.good_tashu.cycle.domain.StationEntity;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
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
                "unused:{stationId}", "tashu:station-availability:latest:v1");

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
                "live:{stationId}", "");

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
                "unused:{stationId}", "live:snapshot");

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
                "unused:{stationId}", "live:snapshot");

        var result = repository.findAll(List.of(master())).get("ST0001");

        assertThat(result.name()).isEqualTo("API 이름");
        assertThat(result.currentCnt()).isEqualTo(5);
        assertThat(result.time()).isEqualTo("2026-09-18T12:30:00+09:00");
    }
}
