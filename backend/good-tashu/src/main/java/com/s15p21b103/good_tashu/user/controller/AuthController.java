package com.s15p21b103.good_tashu.user.controller;

import com.google.rpc.context.AttributeContext;
import com.s15p21b103.good_tashu._util.jwt.JwtProperties;
import com.s15p21b103.good_tashu._util.jwt.JwtService;
import com.s15p21b103.good_tashu._util.jwt.refresh_token.dto.res.RefreshTokenResponseDto;
import com.s15p21b103.good_tashu._util.jwt.refresh_token.service.RefreshTokenService;
import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.user.dto.req.InitUserRequestDto;
import com.s15p21b103.good_tashu.user.dto.res.TokenResponseDto;
import com.s15p21b103.good_tashu.user.service.AuthService;
import com.s15p21b103.good_tashu.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final UserService userService;
    private final RefreshTokenService refreshTokenService;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final AuthService authService;
    
    // 약관 동의를 통한 회원가입 완료
    @PostMapping("/sign-up")
    public ResponseEntity<ApiResponse<TokenResponseDto>> signUp(
            @AuthenticationPrincipal Jwt jwt,
            @CookieValue(name = "refresh_token", required = false)
            String refreshToken,
            @RequestBody @Valid InitUserRequestDto request
    ) {
        AuthService.SignUpResult result = authService.signUp(
                Long.valueOf(jwt.getSubject()),
                jwt.getClaimAsString("authVersion"),
                refreshToken,
                request
        );

        long maxAgeSeconds = Duration.between(
                Instant.now(),
                result.refreshToken().expiresAt()
        ).getSeconds();

        if (maxAgeSeconds <= 0) {
            throw new IllegalStateException(
                    "회원가입은 완료되었으나 토큰이 만료되었습니다."
            );
        }

        ResponseCookie cookie = ResponseCookie
                .from("refresh_token", result.refreshToken().refreshToken())
                .httpOnly(true)
                .secure(jwtProperties.secure())
                .sameSite("Lax")
                .path(jwtProperties.cookiePath())
                .maxAge(maxAgeSeconds)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .body(ApiResponse.success(result.accessToken()));
    }

    // refresh
    @PostMapping("/token/refresh")
    public ResponseEntity<ApiResponse<TokenResponseDto>> refresh(
            @CookieValue(name = "refresh_token", required = false)
            String refreshToken
    ) {
        // 1. Refresh token 검증 + 원자적 Rotation
        // 쿠키가 없거나 유효하지 않으면 서비스에서 예외 발생
        RefreshTokenResponseDto rotated =
                refreshTokenService.rotate(refreshToken);

        // 2. 새 authVersion으로 Access token 발급
        // 현재 JwtService가 DB에서 최신 사용자 권한을 조회합니다.
        String accessToken = jwtService.createAccessToken(
                rotated.userId(),
                rotated.authVersion()
        );

        // 3. 실제 Refresh token 만료 시각까지의 잔여 시간
        // 현재 정책은 Rotation해도 최초 로그인 만료 시각을 유지합니다.
        long maxAgeSeconds = Duration.between(
                Instant.now(),
                rotated.expiresAt()
        ).getSeconds();

        if (maxAgeSeconds <= 0) {
            throw new IllegalStateException(
                    "재발급한 Refresh token의 유효 시간이 부족합니다."
            );
        }

        // 4. 기존 쿠키와 같은 이름/경로로 새 Refresh token 전달
        ResponseCookie cookie = ResponseCookie
                .from("refresh_token", rotated.refreshToken())
                .httpOnly(true)
                .secure(jwtProperties.secure())
                .sameSite("Lax")
                .path(jwtProperties.cookiePath())
                .maxAge(maxAgeSeconds)
                .build();

        TokenResponseDto data = new TokenResponseDto(
                accessToken,
                "Bearer",
                jwtProperties.accessTokenExpires().toSeconds()
        );

        // 5. Refresh token은 응답 본문에 넣지 않습니다.
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .body(ApiResponse.success(data));
    }

    // 로그아웃
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @AuthenticationPrincipal Jwt jwt
    ) {
        // 검증된 AT의 사용자와 버전으로 폐기한다. 오래된 요청은 새 로그인을 지우지 않는다.
        // Redis 장애 시 예외를 전파하여 로그아웃 성공으로 응답하지 않는다.
        refreshTokenService.revoke(
                Long.valueOf(jwt.getSubject()),
                jwt.getClaimAsString("authVersion")
        );

        ResponseCookie expiredCookie = ResponseCookie
                .from("refresh_token", "")
                .httpOnly(true)
                .secure(jwtProperties.secure())
                .sameSite("Lax")
                .path(jwtProperties.cookiePath())
                .maxAge(0)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, expiredCookie.toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .body(ApiResponse.success("로그아웃되었습니다."));
    }
    
    ///////////////////////

}
