package com.s15p21b103.good_tashu._util.jwt;

import com.s15p21b103.good_tashu._util.jwt.refresh_token.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AuthVersionValidator implements OAuth2TokenValidator<Jwt> {

    private final RefreshTokenRepository refreshTokenRepository;

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        // authVersion 클레임 획득
        Object claim = jwt.getClaims().get("authVersion");

        if (!(claim instanceof String authVersion)
                || authVersion.isBlank()) {
            return invalidToken();
        }

        String subject = jwt.getSubject();
        if (subject == null || subject.isBlank()) {
            return invalidToken();
        }
        
        // subject로 userId 획득
        Long userId = null;
        try {
            userId = Long.valueOf(subject);
        } catch (NumberFormatException e) {
            return invalidToken();
        }

        if (userId <= 0) {
            return invalidToken();
        }

        // Redis 장애는 인증 성공으로 처리하지 않고 그대로 전파
        return refreshTokenRepository.findByUserId(userId)
                .filter(stored -> authVersion.equals(stored.authVersion()))
                .map(stored -> OAuth2TokenValidatorResult.success())
                .orElseGet(AuthVersionValidator::invalidToken);
    }

    private static OAuth2TokenValidatorResult invalidToken() {
        return OAuth2TokenValidatorResult.failure(
                new OAuth2Error(
                        "invalid_token",
                        "The access token is no longer valid.",
                        null
                )
        );
    }
}