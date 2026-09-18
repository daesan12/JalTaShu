package com.s15p21b103.good_tashu.admin.dto.res;

import lombok.Builder;

import java.time.LocalDateTime;

public record AdminUserDetailResponse(
        String nickname,
        LocalDateTime createdAt,
        LocalDateTime recentUsingAt,
        Integer totalUsingCnt,
        Long totalUsingTime
) {
}
