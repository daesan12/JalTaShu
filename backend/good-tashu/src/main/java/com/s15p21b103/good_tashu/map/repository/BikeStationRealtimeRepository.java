package com.s15p21b103.good_tashu.map.repository;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.s15p21b103.good_tashu.cycle.domain.StationEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Repository
public class BikeStationRealtimeRepository {
    public record CurrentStation(
            String stationId, String name, String nameEn, String nameCn,
            BigDecimal longitude, BigDecimal latitude, String address,
            Integer parkingCnt, Integer currentCnt, String time
    ) {}

    private final RedisTemplate<String, String> redis;
    private final ObjectMapper mapper;
    private final String keyPattern;
    private final String snapshotKey;

    public BikeStationRealtimeRepository(
            @Qualifier("stationRealtimeRedisTemplate") RedisTemplate<String, String> redis,
            ObjectMapper mapper,
            @Value("${tashu.station.redis.key-pattern:station:{stationId}}") String keyPattern,
            @Value("${tashu.station.redis.snapshot-key:tashu:station-availability:latest:v1}") String snapshotKey) {
        this.redis = redis;
        this.mapper = mapper;
        this.keyPattern = keyPattern;
        this.snapshotKey = snapshotKey;
    }

    public Map<String, CurrentStation> findAll(List<StationEntity> stations) {
        // 수집기는 TTL이 있는 전체 snapshot 한 건을 원자적으로 갱신한다.
        if (!snapshotKey.isBlank()) return readSnapshot(redis.opsForValue().get(snapshotKey), stations);
        if (stations.isEmpty()) return Map.of();
        List<String> keys = stations.stream()
                .map(s -> keyPattern.replace("{stationId}", s.getStationId())).toList();
        List<String> values = redis.opsForValue().multiGet(keys);
        Map<String, CurrentStation> result = new HashMap<>();
        if (values == null) return result;
        for (int i = 0; i < Math.min(values.size(), stations.size()); i++) {
            if (values.get(i) == null) continue;
            try {
                CurrentStation current = parse(mapper.readTree(values.get(i)), stations.get(i), null);
                if (current != null) result.put(current.stationId(), current);
            } catch (Exception ex) {
                log.warn("Invalid realtime station value for key {}", keys.get(i), ex);
            }
        }
        return result;
    }

    private Map<String, CurrentStation> readSnapshot(String raw, List<StationEntity> stations) {
        Map<String, CurrentStation> result = new HashMap<>();
        if (raw == null) return result;
        // snapshot은 전체 대여소를 담으므로 요청한 MySQL 정류소 ID만 결합한다.
        Map<String, StationEntity> byId = new HashMap<>();
        for (StationEntity station : stations) byId.put(station.getStationId(), station);
        try {
            JsonNode root = mapper.readTree(raw);
            JsonNode entries = findEntries(root, 0);
            if (entries == null || !entries.isArray()) return result;
            String snapshotTime = text(root, "time", "savedAt", "saved_at", "updatedAt", "updated_at");
            for (JsonNode entry : entries) {
                String stationId = text(entry, "stationId", "station_id", "rntstnId");
                StationEntity station = byId.get(stationId);
                if (station == null) continue;
                CurrentStation current = parse(entry, station, snapshotTime);
                if (current != null) result.put(stationId, current);
            }
        } catch (Exception ex) {
            log.warn("Invalid realtime station snapshot for key {}", snapshotKey, ex);
        }
        return result;
    }

    private CurrentStation parse(JsonNode node, StationEntity station, String snapshotTime) {
        if (node == null || !node.isObject()) return null;
        String time = text(node, "collected_at", "time", "savedAt", "saved_at", "updatedAt", "updated_at");
        if (time == null) time = snapshotTime;
        JsonNode wrapped = firstNode(node, "station", "data");
        if (wrapped != null && wrapped.isObject()) node = wrapped;
        Integer parking = integer(node, "parkingCnt", "bcyclTpkctNocs");
        Integer current = integer(node, "currentCnt", "bikeCnt", "bikes", "bcyclTpkctNocs");
        if (current == null) current = parking;
        BigDecimal lon = decimal(node, "xPos", "lon", "lng", "lot");
        BigDecimal lat = decimal(node, "yPos", "lat");
        if (lon == null) lon = station.getLongitude();
        if (lat == null) lat = station.getLatitude();
        if (time == null || current == null || lon == null || lat == null) return null;
        String name = text(node, "name", "stationName", "rntstnNm");
        if (name == null) name = station.getName();
        String address = text(node, "address");
        if (address == null) address = station.getAddress();
        return new CurrentStation(station.getStationId(), name, text(node, "nameEn"),
                text(node, "nameCn"), lon, lat, address, parking, current, time);
    }

    private static JsonNode firstNode(JsonNode node, String... names) {
        for (String name : names) if (node.hasNonNull(name)) return node.get(name);
        return null;
    }

    private static JsonNode findEntries(JsonNode node, int depth) {
        if (node == null || depth > 5) return null;
        if (node.isArray()) return node;
        if (!node.isObject()) return null;
        for (String name : List.of("stations", "items", "item", "data", "body", "response", "result")) {
            JsonNode entries = findEntries(node.get(name), depth + 1);
            if (entries != null) return entries;
        }
        return null;
    }

    private static String text(JsonNode node, String... names) {
        JsonNode value = firstNode(node, names);
        return value == null || value.asText().isBlank() ? null : value.asText();
    }

    private static Integer integer(JsonNode node, String... names) {
        String value = text(node, names);
        if (value == null) return null;
        try { return Integer.valueOf(value); } catch (NumberFormatException ex) { return null; }
    }

    private static BigDecimal decimal(JsonNode node, String... names) {
        String value = text(node, names);
        if (value == null) return null;
        try { return new BigDecimal(value); } catch (NumberFormatException ex) { return null; }
    }
}
