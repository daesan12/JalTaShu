package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu._util.jwt.JwtProperties;
import com.s15p21b103.good_tashu._util.jwt.refresh_token.domain.RefreshTokenRecord;
import com.s15p21b103.good_tashu._util.jwt.refresh_token.dto.res.RefreshTokenResponseDto;
import com.s15p21b103.good_tashu._util.jwt.refresh_token.repository.RefreshTokenRepository;
import com.s15p21b103.good_tashu.admin.exception.AdminErrorCode;
import com.s15p21b103.good_tashu.admin.exception.AdminException;
import com.s15p21b103.good_tashu.admin.repository.AdminRepository;
import com.s15p21b103.good_tashu.admin.repository.AdminRefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class AdminRefreshTokenService {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final Pattern TOKEN_FORMAT = Pattern.compile("[A-Za-z0-9_-]{86}");
    private final JwtProperties jwtProperties;
    private final AdminRefreshTokenRepository refreshTokenRepository;
    private final AdminRepository adminRepository;

    // 관리자 인증 완료 후 호출. 관리자당 현재 로그인 하나만 유지한다.
    // refresh token 발급
    public RefreshTokenResponseDto issue(Long adminId) {
        validateAdminId(adminId);
        if (!adminRepository.existsById(adminId)) {
            throw new AdminException(AdminErrorCode.NOT_EXISTS_ADMIN);
        }
        Duration ttl = jwtProperties.refreshTokenExpires();
        if (ttl == null || ttl.isNegative() || ttl.toMillis() < 1) {
            throw new IllegalStateException("Refresh token 유효 기간은 최소 1ms 이상이어야 합니다.");
        }
        String token = generateToken();
        RefreshTokenRecord record = new RefreshTokenRecord(
                adminId, UUID.randomUUID().toString(), hash(token),
                UUID.randomUUID().toString(), Instant.now().plus(ttl).toEpochMilli(),
                RefreshTokenRecord.Status.ACTIVE);

        refreshTokenRepository.issue(record);
        return response(token, record);
    }

    /** 매 rotation마다 AT 인증 버전도 변경. 로그인 최초 만료 시각은 유지한다. */
    public RefreshTokenResponseDto rotate(String rawRefreshToken) {
        if (rawRefreshToken == null || !TOKEN_FORMAT.matcher(rawRefreshToken).matches()) {
            throw invalidToken();
        }

        RefreshTokenRecord current = refreshTokenRepository.findByTokenHash(hash(rawRefreshToken))
                .orElseThrow(this::invalidToken);
        if (current.expiresAtEpochMilli() <= Instant.now().toEpochMilli()) {
            throw invalidToken();
        }

        if (!adminRepository.existsById(current.userId())) throw invalidToken();

        String nextToken = generateToken();
        RefreshTokenRecord replacement = new RefreshTokenRecord(
                current.userId(), current.loginId(), hash(nextToken),
                UUID.randomUUID().toString(), current.expiresAtEpochMilli(),
                RefreshTokenRecord.Status.ACTIVE);
        // USED도 전달해야 Lua가 재사용을 탐지하고 같은 로그인을 폐기할 수 있다.
        // JPA 트랜잭션으로 감싸지 않는다. 아래 예외가 Redis 폐기를 롤백하지 않는다.
        if (refreshTokenRepository.rotate(current, replacement)
                != RefreshTokenRepository.RotationResult.ROTATED) {
            throw invalidToken();
        }
        return response(nextToken, replacement);
    }

    /** adminId와 버전은 검증된 AT에서 가져온다. 오래된 로그아웃은 새 로그인을 지우지 않는다. */
    public void revoke(Long adminId, String expectedAuthVersion) {
        validateAdminId(adminId);
        if (expectedAuthVersion == null || expectedAuthVersion.isBlank()) throw invalidToken();
        refreshTokenRepository.revokeIfVersionMatches(adminId, expectedAuthVersion);
    }

    private RefreshTokenResponseDto response(String token, RefreshTokenRecord record) {
        return new RefreshTokenResponseDto(Long.valueOf(record.userId()), token, record.authVersion(),
                Instant.ofEpochMilli(record.expiresAtEpochMilli()));
    }

    private void validateAdminId(Long adminId) {
        if (adminId == null || adminId <= 0) throw new AdminException(AdminErrorCode.INVALID_ADMIN_ID);
    }

    private AdminException invalidToken() {
        return new AdminException(AdminErrorCode.INVALID_REFRESH_TOKEN);
    }

    private String generateToken() {
        byte[] bytes = new byte[64];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 알고리즘을 사용할 수 없습니다.", e);
        }
    }

}
