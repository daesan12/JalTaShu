package com.s15p21b103.good_tashu.admin.dto.res;

import java.time.LocalDateTime;

public record AdminCycleDetailStatisticsResponse(
        Long usingCnt,
        LocalDateTime recentUsingAt,
        Long unresolvedClaim,
        LocalDateTime registAt
) {
}
