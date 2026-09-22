package com.s15p21b103.good_tashu.claim.dto.res;

import com.s15p21b103.good_tashu.claim.domain.ClaimCategory;
import com.s15p21b103.good_tashu.claim.domain.ClaimStatus;
import com.s15p21b103.good_tashu.claim.domain.ClaimType;

import java.time.LocalDateTime;

public record ClaimListResponse(
        Long claimId,
        ClaimType claimType,
        String nickname,
        ClaimCategory claimCategory,
        String content,
        LocalDateTime createdAt,
        ClaimStatus status,
        String cycleId
) {
}
