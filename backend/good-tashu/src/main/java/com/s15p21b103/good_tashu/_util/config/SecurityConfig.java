package com.s15p21b103.good_tashu._util.config;

import com.s15p21b103.good_tashu._util.jwt.handler.OAuth2LoginFailureHandler;
import com.s15p21b103.good_tashu._util.jwt.handler.OAuth2LoginSuccessHandler;
import com.s15p21b103.good_tashu.user.service.SocialOAuth2UserService;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.data.jpa.repository.Query;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    public UrlBasedCorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:5173"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }
    
    // 소셜로그인 전용 시큐리티 필터 체인
    @Bean
    @Order(1)
    public SecurityFilterChain oauth2SecurityFilterChain(
            HttpSecurity http,
            SocialOAuth2UserService socialOAuth2UserService,
            OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler,
            OAuth2LoginFailureHandler oAuth2LoginFailureHandler
    ) throws Exception {
        http
                // 소셜 로그인에 대해서만 받기
                .securityMatcher("/api/auth/oauth/**")
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll()
                )
                // 소셜 로그인 경로 처리
                .oauth2Login(oauth2 -> oauth2
                        // 소셜 로그인을 요청할 경로(기본은 /oauth2/authorization/{registrationId})
                        .authorizationEndpoint(authorizationEndpointConfig ->
                                authorizationEndpointConfig.baseUri("/api/auth/oauth")
                        )
                        // 리다이렉트 받을 경로(기본은 /login/oauth2/code/{registrationId})
                        .redirectionEndpoint(redirection -> redirection
                                .baseUri("/api/auth/oauth/callback/*")
                        )
                        // 로그인 정보를 기반으로 DB에 유저 저장(해당 service의 loadUser()호출)
                        .userInfoEndpoint(userInfoEndpointConfig ->
                                userInfoEndpointConfig.userService(socialOAuth2UserService)
                        )
                        .successHandler(oAuth2LoginSuccessHandler)
                        .failureHandler(oAuth2LoginFailureHandler)
                );

        return http.build();
    }

    @Bean
    @Order(2)
    public SecurityFilterChain apiSecurityFilterChain(
            HttpSecurity http,
            @Qualifier("accessTokenJwtDecoder")
            JwtDecoder accessTokenJwtDecoder,
            JwtAuthenticationConverter jwtAuthenticationConverter
            ) throws Exception {
        http
                .securityMatcher("/api/**")
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )
                .authorizeHttpRequests(auth -> auth
                        // Refresh Token API는 자체적으로 Refresh Token을 검증
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                                "/api/admin/login", "/api/admin/token/refresh").permitAll()
                        .requestMatchers("/api/auth/token/**")
                        .permitAll()
                        // 헬스체크 API
                        .requestMatchers("/api/actuator/health/**")
                        .permitAll()
                        // ADMIN이 사용하는 API
                        .requestMatchers("/api/admin/**")
                        .hasRole("ADMIN")
                        // GUEST가 사용하는 API
                        .requestMatchers("/api/auth/sign-up")
                        .hasRole("GUEST")
                        // 가입 전 사용자도 유효한 AT로 로그아웃할 수 있다.
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/auth/logout")
                        .hasAnyRole("USER", "GUEST")
                        // 그 외 일반 API는 USER만 허용
                        .anyRequest()
                        .hasRole("USER")
                )
                .oauth2ResourceServer(resourceServer ->
                        resourceServer.jwt(jwt ->
                                jwt
                                        .decoder(accessTokenJwtDecoder)
                                        .jwtAuthenticationConverter(jwtAuthenticationConverter)
                        )
                );
        return http.build();
    }
}
