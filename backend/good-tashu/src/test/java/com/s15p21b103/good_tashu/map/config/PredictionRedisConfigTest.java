package com.s15p21b103.good_tashu.map.config;

import com.s15p21b103.good_tashu.map.repository.BikeStationRealtimeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;

class PredictionRedisConfigTest {
    @Test
    void keepsApplicationRealtimeAndPredictionDatabasesSeparate() {
        new ApplicationContextRunner()
                .withUserConfiguration(PredictionRedisConfig.class, BikeStationRealtimeRepository.class)
                .withBean(ObjectMapper.class, ObjectMapper::new)
                .withPropertyValues("spring.data.redis.database=1",
                        "tashu.station.redis.database=3",
                        "tashu.prediction.redis.database=2")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(BikeStationRealtimeRepository.class);
                    assertThat(context.getBean("redisConnectionFactory", LettuceConnectionFactory.class)
                            .getDatabase()).isEqualTo(1);
                    assertThat(context.getBean("stationRealtimeRedisConnectionFactory", LettuceConnectionFactory.class)
                            .getDatabase()).isEqualTo(3);
                    assertThat(context.getBean("predictionRedisConnectionFactory", LettuceConnectionFactory.class)
                            .getDatabase()).isEqualTo(2);
                    assertThat(context.getBean("stationRealtimeRedisTemplate", RedisTemplate.class)
                            .getConnectionFactory()).isSameAs(context.getBean("stationRealtimeRedisConnectionFactory"));
                });
    }
}
