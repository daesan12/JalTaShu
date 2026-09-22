package com.s15p21b103.good_tashu.map.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class PredictionRedisConfig {
    // 기본 Redis 연결을 유지하고 예측은 기본 DB 2, 현황은 수집기와 같은 DB로 연결한다.
    @Bean("redisConnectionFactory")
    @Primary
    public LettuceConnectionFactory applicationRedisConnectionFactory(
            @Value("${spring.data.redis.host:localhost}") String host,
            @Value("${spring.data.redis.port:6379}") int port,
            @Value("${spring.data.redis.database:0}") int database,
            @Value("${spring.data.redis.password:}") String password
    ) {
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration(host, port);
        config.setDatabase(database);
        if (!password.isBlank()) config.setPassword(RedisPassword.of(password));
        return new LettuceConnectionFactory(config);
    }

    @Bean("predictionRedisConnectionFactory")
    public LettuceConnectionFactory predictionRedisConnectionFactory(
            @Value("${tashu.prediction.redis.host:${spring.data.redis.host:localhost}}") String host,
            @Value("${tashu.prediction.redis.port:${spring.data.redis.port:6379}}") int port,
            @Value("${tashu.prediction.redis.database:2}") int database,
            @Value("${tashu.prediction.redis.password:${spring.data.redis.password:}}") String password
    ) {
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration(host, port);
        config.setDatabase(database);
        if (!password.isBlank()) config.setPassword(RedisPassword.of(password));
        return new LettuceConnectionFactory(config);
    }

    @Bean("stationRealtimeRedisConnectionFactory")
    public LettuceConnectionFactory stationRealtimeRedisConnectionFactory(
            @Value("${tashu.station.redis.host:${spring.data.redis.host:localhost}}") String host,
            @Value("${tashu.station.redis.port:${spring.data.redis.port:6379}}") int port,
            @Value("${tashu.station.redis.database:${spring.data.redis.database:0}}") int database,
            @Value("${tashu.station.redis.password:${spring.data.redis.password:}}") String password
    ) {
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration(host, port);
        config.setDatabase(database);
        if (!password.isBlank()) config.setPassword(RedisPassword.of(password));
        return new LettuceConnectionFactory(config);
    }

    @Bean("predictionRedisTemplate")
    public RedisTemplate<String, String> predictionRedisTemplate(
            @Qualifier("predictionRedisConnectionFactory") LettuceConnectionFactory factory
    ) {
        RedisTemplate<String, String> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }

    @Bean("stationRealtimeRedisTemplate")
    public RedisTemplate<String, String> stationRealtimeRedisTemplate(
            @Qualifier("stationRealtimeRedisConnectionFactory") LettuceConnectionFactory factory
    ) {
        RedisTemplate<String, String> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new StringRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }
}
