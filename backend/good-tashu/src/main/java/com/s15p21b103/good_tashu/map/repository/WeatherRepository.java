package com.s15p21b103.good_tashu.map.repository;

import com.s15p21b103.good_tashu.map.dto.res.WeatherResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Slf4j
@Repository
public class WeatherRepository {
    private final RedisTemplate<String, String> redis;
    private final ObjectMapper mapper;
    private final String latestKey;

    public WeatherRepository(
            @Qualifier("stationRealtimeRedisTemplate") RedisTemplate<String, String> redis,
            ObjectMapper mapper,
            @Value("${tashu.weather.redis.latest-key:tashu:weather:latest:v1}") String latestKey
    ) {
        this.redis = redis;
        this.mapper = mapper;
        this.latestKey = latestKey;
    }

    public WeatherResponse findLatest() {
        try {
            String raw = redis.opsForValue().get(latestKey);
            if (raw == null || raw.isBlank()) return null;

            JsonNode json = mapper.readTree(raw);
            if (json.path("schema_version").asInt() != 1) {
                throw new IllegalArgumentException("unsupported schema_version");
            }
            return new WeatherResponse(
                    OffsetDateTime.parse(requiredText(json, "observed_at")),
                    new BigDecimal(requiredText(json, "temperature")),
                    new BigDecimal(requiredText(json, "rainfall_1h"))
            );
        } catch (Exception ex) {
            // 날씨 부가 정보 장애가 지도 API 전체 장애로 전파되지 않게 한다.
            log.warn("Unable to read latest weather from Redis key {}", latestKey, ex);
            return null;
        }
    }

    private static String requiredText(JsonNode json, String field) {
        String value = json.path(field).asText();
        if (value == null || value.isBlank()) throw new IllegalArgumentException("missing field: " + field);
        return value;
    }
}
