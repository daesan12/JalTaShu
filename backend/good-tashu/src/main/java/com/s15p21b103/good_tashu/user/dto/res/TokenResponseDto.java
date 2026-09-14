package com.s15p21b103.good_tashu.user.dto.res;

public record TokenResponseDto (
        String accessToken,
        String tokenType,
        long expiresIn
){}
