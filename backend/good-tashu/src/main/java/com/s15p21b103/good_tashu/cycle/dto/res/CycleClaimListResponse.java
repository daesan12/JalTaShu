package com.s15p21b103.good_tashu.cycle.dto.res;

import com.s15p21b103.good_tashu.cycle.domain.Category;

import java.time.LocalDateTime;

public record CycleClaimListResponse(
        Long claimId,
        String nickname,
        Category claimCategory,
        String content,
        LocalDateTime createdAt
) {
}
