package com.s15p21b103.good_tashu.admin.controller;

import com.s15p21b103.good_tashu.admin.dto.res.AdminUserListResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminUserBanHistoryResponse;
import com.s15p21b103.good_tashu.admin.service.AdminUserService;
import com.s15p21b103.good_tashu.admin.service.AdminAuthService;
import com.s15p21b103.good_tashu.admin.dto.req.AdminLoginRequest;
import com.s15p21b103.good_tashu.user.dto.res.TokenResponseDto;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import com.s15p21b103.good_tashu._util.jwt.JwtProperties;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import java.time.Duration;
import java.time.Instant;
import com.s15p21b103.good_tashu.admin.annotation.CurrentAdminId;
import com.s15p21b103.good_tashu.admin.dto.req.UserBanRequest;
import jakarta.validation.Valid;
import com.s15p21b103.good_tashu._util.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminUserService adminUserService;
    private final AdminAuthService adminAuthService;
    private final JwtProperties jwtProperties;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<TokenResponseDto>> login(
            @Valid @RequestBody AdminLoginRequest request) {
        return tokenResponse(adminAuthService.login(request));
    }

    @PostMapping("/token/refresh")
    public ResponseEntity<ApiResponse<TokenResponseDto>> refresh(
            @CookieValue(name = "admin_refresh_token", required = false) String refreshToken) {
        return tokenResponse(adminAuthService.refresh(refreshToken));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(@CurrentAdminId Long adminId,
            @AuthenticationPrincipal Jwt jwt) {
        adminAuthService.logout(adminId, jwt.getClaimAsString("authVersion"));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.SET_COOKIE, refreshCookie("", 0).toString())
                .body(ApiResponse.success("로그아웃되었습니다."));
    }

    private ResponseEntity<ApiResponse<TokenResponseDto>> tokenResponse(AdminAuthService.LoginResult result) {
        long remaining = Duration.between(Instant.now(), result.refreshToken().expiresAt()).getSeconds();
        if (remaining <= 0) throw new IllegalStateException("관리자 리프레시 토큰이 만료되었습니다.");
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("Pragma", "no-cache")
                .header(HttpHeaders.SET_COOKIE, refreshCookie(result.refreshToken().refreshToken(), remaining).toString())
                .body(ApiResponse.success(result.accessToken()));
    }

    private ResponseCookie refreshCookie(String token, long maxAge) {
        return ResponseCookie.from("admin_refresh_token", token).httpOnly(true)
                .secure(jwtProperties.secure()).sameSite("Lax").path("/api/admin")
                .maxAge(maxAge).build();
    }

    //사용자 목록 조회
    @GetMapping("/user/list")
    public ApiResponse<List<AdminUserListResponse>> getUserList(
            @CurrentAdminId Long adminId,
            @RequestParam(defaultValue = "") String statement,
            @RequestParam(defaultValue = "newest") String order) {
        return ApiResponse.success(adminUserService.getUserList(statement, order));
    }
    //TODO: 경로 구현하고 구현
    //특정 사용자 상세조회

    //사용자 밴
    @PostMapping("/user/{userId}/ban")
    public ApiResponse<Void> banUser(@CurrentAdminId Long adminId,
                                     @PathVariable Long userId,
                                     @Valid @RequestBody UserBanRequest request) {
        adminUserService.banUser(adminId, userId, request);
        return ApiResponse.success("사용자 밴이 등록되었습니다.");
    }
    //사용자 밴 기록 확인
    @GetMapping("/user/{userId}/ban")
        public ApiResponse<AdminUserBanHistoryResponse> getUserBanHistory(
            @CurrentAdminId Long adminId,
            @PathVariable Long userId) {
        return ApiResponse.success(adminUserService.getUserBanHistory(userId));
    }

    //사용자 밴 해제
    @PostMapping("/user/ban/{banRecordId}/release")
    public ApiResponse<Void> unbanUser(@PathVariable Long banRecordId) {
        adminUserService.releaseUserBan(banRecordId);
        return ApiResponse.success("사용자 밴이 해제되었습니다.");
    }
}
