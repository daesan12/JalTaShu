package com.s15p21b103.good_tashu.map.client;

import com.s15p21b103.good_tashu.map.client.dto.NaverPlaceResponse;
import com.s15p21b103.good_tashu.map.exception.MapException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;

import static com.s15p21b103.good_tashu.map.exception.MapErrorCode.*;

@Component
public class NaverPlaceClient {
    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final boolean credentialsConfigured;

    public NaverPlaceClient(@Qualifier("naverRestClient") RestClient restClient,
                            ObjectMapper objectMapper,
                            @Value("${NAVER_CLIENT_ID:}") String clientId,
                            @Value("${NAVER_CLIENT_SECRET:}") String clientSecret) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.credentialsConfigured = !clientId.isBlank() && !clientSecret.isBlank();
    }

    public NaverPlaceResponse search(String query) {
        if (query == null || query.isBlank()) {
            throw new MapException(SEARCH_QUERY_REQUIRED);
        }
        if (!credentialsConfigured) {
            throw new MapException(NAVER_API_ERROR);
        }
        try {
            String body = restClient.get()
                    .uri(builder -> builder.path("/search/v1/local")
                            .queryParam("query", "{query}")
                            .queryParam("display", 5)
                            .queryParam("start", 1)
                            .queryParam("sort", "random")
                            .queryParam("format", "json")
                            .build(query.strip()))
                    .retrieve().body(String.class);
            if (body == null || body.isBlank()) {
                throw new MapException(NAVER_RESPONSE_INVALID);
            }
            NaverPlaceResponse response = objectMapper.readValue(body, NaverPlaceResponse.class);
            if (response == null || response.items() == null) {
                throw new MapException(NAVER_RESPONSE_INVALID);
            }
            return response;
        } catch (RestClientResponseException e) {
            throw new MapException(e.getStatusCode().value() == 504 ? NAVER_API_TIMEOUT : NAVER_API_ERROR);
        } catch (ResourceAccessException e) {
            for (Throwable cause = e; cause != null; cause = cause.getCause()) {
                if (cause instanceof HttpTimeoutException || cause instanceof SocketTimeoutException) {
                    throw new MapException(NAVER_API_TIMEOUT);
                }
            }
            throw new MapException(NAVER_API_ERROR);
        } catch (RestClientException | JacksonException e) {
            throw new MapException(NAVER_RESPONSE_INVALID);
        }
    }
}
