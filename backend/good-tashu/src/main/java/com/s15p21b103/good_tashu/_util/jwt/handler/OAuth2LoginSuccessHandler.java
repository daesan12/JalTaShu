package com.s15p21b103.good_tashu._util.jwt.handler;

import com.s15p21b103.good_tashu._util.jwt.JwtProperties;
import com.s15p21b103.good_tashu._util.jwt.JwtService;
import com.s15p21b103.good_tashu._util.jwt.refresh_token.dto.res.RefreshTokenResponseDto;
import com.s15p21b103.good_tashu._util.jwt.refresh_token.service.RefreshTokenService;
import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.user.domain.SocialOAuth2User;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final JsonMapper jsonMapper;
    private final RefreshTokenService refreshTokenService;

    public record LoginTokenResponse(
            String accessToken,
            String tokenType,
            long expiresIn
    ) {}

    // 로그인 성공 시
    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        // SocialOAuth2User에서 loadUser()의 반환인 SocialOAuth2User가 authentication의 principal로 있다.
        SocialOAuth2User socialOAuth2User = (SocialOAuth2User) authentication.getPrincipal();

        // Refresh Token 발급
        RefreshTokenResponseDto refreshToken = refreshTokenService.issue(socialOAuth2User.getUserId());

        // Access Token 발급
        String accessToken = jwtService.createAccessToken(socialOAuth2User.getUserId(), refreshToken.authVersion());

        // 응답 데이터 구성
        LoginTokenResponse data = new LoginTokenResponse(
                accessToken,
                "Bearer",
                jwtProperties.accessTokenExpires().toSeconds()
        );

        // refresh Token을 Http Only 쿠키 전달
        // 설정된 전체 수명이 아니라 실제 만료까지 남은 시간을 사용
        long maxAgeSeconds = Duration.between(
                Instant.now(),
                refreshToken.expiresAt()
        ).getSeconds();

        if(maxAgeSeconds <= 0)
            throw new IllegalStateException("Refresh token이 이미 만료되었습니다.");

        ResponseCookie cookie = ResponseCookie
                .from("refresh_token", refreshToken.refreshToken())
                // JavaScript의 document.cookie로 읽을 수 없음
                .httpOnly(true)
                // HTTPS 전송용 쿠키
                .secure(jwtProperties.secure())
                // 같은 사이트의 요청을 중심으로 쿠키 전송 허용
                .sameSite("LAX")
                // 재발급 등 이 경로에 해당하는 요청에 전송
                .path(jwtProperties.cookiePath())
                .maxAge(maxAgeSeconds)
                .build();

        // HTTP 응답 헤더 설정
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        response.setHeader(HttpHeaders.PRAGMA, "no-cache");
        // refresh token 저장
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        // 응답 데이터를 json으로 변환하여 작성
        response.getWriter().write(
                jsonMapper.writeValueAsString(ApiResponse.success(data))
        );


    }
}
