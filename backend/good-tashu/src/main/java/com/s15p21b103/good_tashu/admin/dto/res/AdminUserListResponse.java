package com.s15p21b103.good_tashu.admin.dto.res;

import java.time.LocalDateTime;

public record AdminUserListResponse(
        Long userId,
        String nickname,
        LocalDateTime recentUsingAt,
        String userStatement
) {
}
