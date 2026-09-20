package com.s15p21b103.good_tashu.admin.dto.res;

import com.s15p21b103.good_tashu.claim.domain.ClaimCategory;
import com.s15p21b103.good_tashu.claim.domain.ClaimStatus;
import com.s15p21b103.good_tashu.claim.domain.ClaimType;

import java.time.LocalDateTime;

public record AdminClaimResponse(
        Long claimId,
        ClaimType claimType,
        Long userId,
        String nickname,
        String cycleId,
        ClaimCategory category,
        String content,
        LocalDateTime createdAt,
        Long cycleReportNum,
        ClaimStatus status,
        boolean hasComment
) {
}
