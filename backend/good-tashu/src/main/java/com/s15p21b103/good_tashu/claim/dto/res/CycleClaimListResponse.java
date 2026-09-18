package com.s15p21b103.good_tashu.claim.dto.res;

import com.s15p21b103.good_tashu.claim.domain.ClaimCategory;

import java.time.LocalDateTime;

public record CycleClaimListResponse(
        Long claimId,
        String nickname,
        ClaimCategory claimCategory,
        String content,
        LocalDateTime createdAt
) {
}
