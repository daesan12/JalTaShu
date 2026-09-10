package com.s15p21b103.good_tashu.cycle.dto.res;

import com.s15p21b103.good_tashu.cycle.domain.ClaimCategory;

import java.time.LocalDateTime;

public record CycleClaimListResponse(
        Long claimId,
        String nickname,
        ClaimCategory claimCategory,
        String content,
        LocalDateTime createdAt
) {
}
