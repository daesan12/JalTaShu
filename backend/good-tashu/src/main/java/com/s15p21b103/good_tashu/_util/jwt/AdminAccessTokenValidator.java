package com.s15p21b103.good_tashu._util.jwt;

import com.s15p21b103.good_tashu.admin.repository.AdminRepository;
import com.s15p21b103.good_tashu.admin.repository.AdminRefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class AdminAccessTokenValidator implements OAuth2TokenValidator<Jwt> {
    private final AdminRepository adminRepository;
    private final AdminRefreshTokenRepository sessions;

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        String subject = jwt.getSubject();
        if (!"ADMIN".equals(jwt.getClaims().get("principalType"))
                || !List.of("ADMIN").equals(jwt.getClaims().get("roles"))
                || subject == null || !subject.matches("admin:[1-9][0-9]*")) {
            return invalid();
        }
        long adminId;
        try {
            adminId = Long.parseLong(subject.substring(6));
        } catch (NumberFormatException e) {
            return invalid();
        }
        Object version = jwt.getClaims().get("authVersion");
        if (!(version instanceof String value) || value.isBlank() || !adminRepository.existsById(adminId)) {
            return invalid();
        }
        return sessions.findByUserId(adminId)
                .filter(record -> value.equals(record.authVersion()))
                .map(record -> OAuth2TokenValidatorResult.success()).orElseGet(this::invalid);
    }

    private OAuth2TokenValidatorResult invalid() {
        return OAuth2TokenValidatorResult.failure(
                new OAuth2Error("invalid_token", "Invalid administrator token", null));
    }
}
