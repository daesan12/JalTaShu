package com.s15p21b103.good_tashu.admin.dto.res;

import java.time.LocalDateTime;

public record AdminUserBanHistoryResponse(
        Long banRecordId,
        LocalDateTime banStartedAt,
        LocalDateTime banEndAt,
        long period,
        String comment,
        Long adminId
) {
}
