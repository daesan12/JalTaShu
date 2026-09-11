package com.s15p21b103.good_tashu.map.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

@Configuration
public class NaverApiConfig {
    @Bean
    public RestClient naverRestClient(
            @Value("${NAVER_CLIENT_ID:}") String clientId,
            @Value("${NAVER_CLIENT_SECRET:}") String clientSecret) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3)).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(5));
        return RestClient.builder()
                .baseUrl("https://naverapihub.apigw.ntruss.com")
                .requestFactory(factory)
                .defaultHeader("X-NCP-APIGW-API-KEY-ID", clientId)
                .defaultHeader("X-NCP-APIGW-API-KEY", clientSecret)
                .build();
    }
}
