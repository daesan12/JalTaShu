package com.s15p21b103.good_tashu.admin.dto.res;


import com.s15p21b103.good_tashu.admin.domain.UserBanRecordEntity;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

public record AdminUserBanHistoryResponse(
        Long banRecordId,
        LocalDateTime banStartedAt,
        LocalDateTime banEndAt,
        long period,
        String comment,
        Long adminId
) {
}
