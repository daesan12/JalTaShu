package com.s15p21b103.good_tashu._util.config;

import com.s15p21b103.good_tashu.user.service.SocialOAuth2UserService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {
    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            SocialOAuth2UserService socialOAuth2UserService
    ) throws Exception {

        http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/",
                                "/error",
                                // 소셜 로그인의 모든 요청(클라이언트 및 소셜 로그인 서버)를 받을 수 있도록
                                "/api/auth/oauth/**"
                        ).permitAll()
                        .anyRequest().authenticated()
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
                                userInfoEndpointConfig.userService(socialOAuth2UserService))
                        .defaultSuccessUrl("/api/users/me", true)
                );

        return http.build();
    }
}
