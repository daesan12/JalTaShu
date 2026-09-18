package com.s15p21b103.good_tashu.admin.dto.res;

import com.s15p21b103.good_tashu.claim.domain.ClaimReportCategory;
import java.time.LocalDateTime;

public record AdminCycleClaimReportResponse(
        Long reportId,
        ClaimReportCategory reportCategory,
        LocalDateTime createdAt,
        Long userId,
        String nickname
) {
}
