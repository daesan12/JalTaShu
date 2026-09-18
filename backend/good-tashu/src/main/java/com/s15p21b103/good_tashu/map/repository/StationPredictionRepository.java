package com.s15p21b103.good_tashu.map.repository;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.s15p21b103.good_tashu.map.dto.res.BikeStationForecastPoint;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Repository
public class StationPredictionRepository {
    private final RedisTemplate<String, String> redis;
    private final ObjectMapper mapper;

    public StationPredictionRepository(
            @Qualifier("predictionRedisTemplate") RedisTemplate<String, String> redis,
            ObjectMapper mapper) {
        this.redis = redis;
        this.mapper = mapper;
    }

    public List<BikeStationForecastPoint> findNext15Minutes(String stationId) {
        Instant now = Instant.now();
        Instant until = now.plus(15, ChronoUnit.MINUTES);
        // pred:{stationId}:{1..15}의 분 인덱스는 각 값의 updated_at을 기준으로 한다.
        List<String> keys = new ArrayList<>(15);
        for (int minute = 1; minute <= 15; minute++) keys.add("pred:" + stationId + ":" + minute);
        List<String> values = redis.opsForValue().multiGet(keys);
        List<BikeStationForecastPoint> points = new ArrayList<>();
        if (values == null) return points;
        for (int i = 0; i < Math.min(values.size(), 15); i++) {
            String value = values.get(i);
            if (value == null) continue;
            try {
                JsonNode json = mapper.readTree(value);
                OffsetDateTime updatedAt = OffsetDateTime.parse(json.path("updated_at").asText());
                OffsetDateTime target = updatedAt.plusMinutes(i + 1);
                // 갱신이 늦은 예측은 지난 시각이나 15분 밖의 결과일 수 있다.
                if (!target.toInstant().isAfter(now) || target.toInstant().isAfter(until)) continue;
                points.add(new BikeStationForecastPoint(
                        target,
                        new BigDecimal(json.path("bikes").asText()),
                        new BigDecimal(json.path("prob_out").asText())));
            } catch (Exception ex) {
                log.warn("Invalid prediction value for key {}", keys.get(i), ex);
            }
        }
        points.sort(Comparator.comparing(BikeStationForecastPoint::dateTime));
        return points;
    }
}
