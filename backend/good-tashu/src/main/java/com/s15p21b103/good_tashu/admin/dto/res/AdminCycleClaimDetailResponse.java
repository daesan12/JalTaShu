package com.s15p21b103.good_tashu.admin.dto.res;

import com.s15p21b103.good_tashu.cycle.domain.ClaimStatus;
import java.time.LocalDateTime;
import java.util.List;

public record AdminCycleClaimDetailResponse(
        Long claimId,
        String cycleId,
        Long userId,
        String nickname,
        LocalDateTime createdAt,
        Long recordId,
        LocalDateTime rentalAt,
        LocalDateTime returnAt,
        String content,
        ClaimStatus statement,
        String adminComment,
        List<AdminCycleClaimReportResponse> report
) {
}
