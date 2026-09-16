package com.s15p21b103.good_tashu.admin.dto.res;

import com.s15p21b103.good_tashu.cycle.domain.ClaimCategory;
import com.s15p21b103.good_tashu.cycle.domain.ClaimStatus;
import java.time.LocalDateTime;

public record AdminCycleClaimListResponse(
        Long claimId,
        String cycleId,
        Long recordId,
        String content,
        ClaimCategory category,
        String nickname,
        Long userId,
        LocalDateTime createdAt,
        Long cycleReportNum,
        ClaimStatus status,
        boolean hasComment
) {
}
