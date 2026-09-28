package com.s15p21b103.good_tashu._util.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityConfigBearerTokenResolverTest {
    private final BearerTokenResolver resolver = SecurityConfig.bearerTokenResolver();

    @Test
    void ignoresExpiredBearerOnTokenlessEndpoints() {
        for (String path : new String[]{"/api/admin/token/refresh", "/api/admin/login", "/api/auth/token/refresh"}) {
            assertThat(resolver.resolve(request(path))).as(path).isNull();
        }
    }

    @Test
    void resolvesBearerOnOtherEndpoints() {
        assertThat(resolver.resolve(request("/api/admin/user/list"))).isEqualTo("expired-token");
        assertThat(resolver.resolve(request("/api/admin/logout"))).isEqualTo("expired-token");
    }

    private MockHttpServletRequest request(String path) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.addHeader("Authorization", "Bearer expired-token");
        return request;
    }
}
