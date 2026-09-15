package com.s15p21b103.good_tashu._util.jwt.refresh_token.dto.res;

import java.time.Instant;

public record RefreshTokenResponseDto(
        Long userId,
        String refreshToken,
        String authVersion,
        Instant expiresAt
) {
}
