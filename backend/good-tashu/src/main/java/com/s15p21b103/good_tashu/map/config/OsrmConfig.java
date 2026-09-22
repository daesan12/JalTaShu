package com.s15p21b103.good_tashu.map.config;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.web.client.RestClient;

@Configuration
public class OsrmConfig {
    @Bean
    public RestClient osrmRestClient() {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3)).build());
        factory.setReadTimeout(Duration.ofSeconds(10));
        // OSRM 5.27.1's deflate response is incompatible with Spring's decompressor.
        // Request uncompressed local responses to avoid ZipException: incorrect header check.
        return RestClient.builder().requestFactory(factory)
                .defaultHeader(HttpHeaders.ACCEPT_ENCODING, "identity").build();
    }

    @Bean(destroyMethod = "close")
    public ExecutorService osrmExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }
}
