package com.s15p21b103.good_tashu._util.jwt.refresh_token.domain;

import com.fasterxml.jackson.annotation.JsonFormat;

/** Redis 전용 DTO. userId는 Lua 숫자 변환 시 정밀도 손실을 피하도록 문자열로 저장한다. */
public record RefreshTokenRecord(
        @JsonFormat(shape = JsonFormat.Shape.STRING) Long userId,
        String loginId,
        String tokenHash,
        String authVersion,
        long expiresAtEpochMilli,
        Status status
) {
    public enum Status { ACTIVE, USED }
}
