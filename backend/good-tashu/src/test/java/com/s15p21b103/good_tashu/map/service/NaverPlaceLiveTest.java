package com.s15p21b103.good_tashu.map.service;

import com.s15p21b103.good_tashu.map.client.NaverPlaceClient;
import com.s15p21b103.good_tashu.map.config.NaverApiConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.Reader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 실제 네이버 API 호출로 호출 한도를 사용합니다.
 * RUN_NAVER_LIVE_TEST=true일 때만 실행합니다.
 * 인증 정보는 환경변수를 우선 사용하고, 없으면 backend-local.env에서 읽습니다.
 */
@EnabledIfEnvironmentVariable(named = "RUN_NAVER_LIVE_TEST", matches = "true")
class NaverPlaceLiveTest {

    @Test
    @DisplayName("실제 네이버 장소 검색 응답을 서비스 DTO로 변환한다")
    void searchPlaceCallsRealNaverApi() throws IOException {
        Properties localProperties = new Properties();
        Path localEnv = Path.of("backend-local.env");
        if (Files.isRegularFile(localEnv)) {
            try (Reader reader = Files.newBufferedReader(localEnv, StandardCharsets.UTF_8)) {
                localProperties.load(reader);
            }
        }
        String clientId = credential("NAVER_CLIENT_ID", localProperties);
        String clientSecret = credential("NAVER_CLIENT_SECRET", localProperties);
        var restClient = new NaverApiConfig().naverRestClient(clientId, clientSecret);
        var service = new MapService(new NaverPlaceClient(restClient, JsonMapper.builder().build(), clientId, clientSecret),
                org.mockito.Mockito.mock(com.s15p21b103.good_tashu.map.repository.RecentPlaceRepository.class),
                org.mockito.Mockito.mock(com.s15p21b103.good_tashu.user.repository.UserRepository.class),
                org.mockito.Mockito.mock(PathService.class));

        var results = service.searchPlace("대전역");

        assertThat(results).isNotEmpty().hasSizeLessThanOrEqualTo(5);
        assertThat(results).allSatisfy(result -> {
            assertThat(result.title()).isNotBlank().doesNotContain("<b>", "</b>");
            assertThat(result.address()).isNotBlank();
            assertThat(result.xPos()).isBetween(new BigDecimal("-180"), new BigDecimal("180"));
            assertThat(result.yPos()).isBetween(new BigDecimal("-90"), new BigDecimal("90"));
        });
    }

    private static String credential(String name, Properties localProperties) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            value = localProperties.getProperty(name);
        }
        // 인증 값 자체를 assertion 메시지나 로그에 포함하지 않습니다.
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " 환경변수 또는 backend-local.env 설정이 필요합니다.");
        }
        return value.strip();
    }
}
