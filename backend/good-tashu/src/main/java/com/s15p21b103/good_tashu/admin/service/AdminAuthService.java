package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu._util.jwt.JwtProperties;
import com.s15p21b103.good_tashu._util.jwt.JwtService;
import com.s15p21b103.good_tashu._util.jwt.refresh_token.dto.res.RefreshTokenResponseDto;
import com.s15p21b103.good_tashu.admin.dto.req.AdminLoginRequest;
import com.s15p21b103.good_tashu.admin.exception.AdminErrorCode;
import com.s15p21b103.good_tashu.admin.exception.AdminException;
import com.s15p21b103.good_tashu.admin.repository.AdminRepository;
import com.s15p21b103.good_tashu.user.dto.res.TokenResponseDto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class AdminAuthService {
    private final AdminRepository adminRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final AdminRefreshTokenService refreshTokenService;

    public record LoginResult(TokenResponseDto accessToken, RefreshTokenResponseDto refreshToken) {}

    public LoginResult login(AdminLoginRequest request) {
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new AdminException(AdminErrorCode.INVALID_ADMIN_CREDENTIALS);
        }
        var admin = adminRepository.findByIdEquals(request.id().strip())
                .orElseThrow(() -> new AdminException(AdminErrorCode.INVALID_ADMIN_CREDENTIALS));
        if (!passwordEncoder.matches(request.password(), admin.getPassword())) {
            throw new AdminException(AdminErrorCode.INVALID_ADMIN_CREDENTIALS);
        }
        return tokens(refreshTokenService.issue(admin.getAdminId()));
    }

    public LoginResult refresh(String rawToken) {
        return tokens(refreshTokenService.rotate(rawToken));
    }

    public void logout(Long adminId, String authVersion) {
        refreshTokenService.revoke(adminId, authVersion);
    }

    private LoginResult tokens(RefreshTokenResponseDto refresh) {
        return new LoginResult(new TokenResponseDto(
                jwtService.createAdminAccessToken(refresh.userId(), refresh.authVersion()),
                "Bearer", jwtProperties.accessTokenExpires().toSeconds()), refresh);
    }
}
