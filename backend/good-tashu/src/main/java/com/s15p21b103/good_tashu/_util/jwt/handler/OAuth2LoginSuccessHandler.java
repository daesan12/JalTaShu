package com.s15p21b103.good_tashu._util.jwt.handler;

import com.s15p21b103.good_tashu._util.jwt.JwtProperties;
import com.s15p21b103.good_tashu._util.jwt.JwtService;
import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.user.domain.SocialOAuth2User;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final JsonMapper jsonMapper;

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

        // Access Token 발급
        String accessToken = jwtService.createAccessToken(socialOAuth2User.getUserId());



        // 응답 데이터 구성
        LoginTokenResponse data = new LoginTokenResponse(
                accessToken,
                "Bearer",
                jwtProperties.accessTokenExpires().toSeconds()
        );

        // HTTP 응답 설정
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        response.setHeader(HttpHeaders.PRAGMA, "no-cache");
        
        // 응답 데이터를 json으로 변환하여 작성
        response.getWriter().write(
                jsonMapper.writeValueAsString(ApiResponse.success(data))
        );
        
        // TODO: 이후에 properties로 리다이렉트 url 연결
        response.sendRedirect("/");
    }
}
