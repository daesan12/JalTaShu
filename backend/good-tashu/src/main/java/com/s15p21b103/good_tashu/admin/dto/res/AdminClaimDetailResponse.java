package com.s15p21b103.good_tashu.admin.dto.res;

import com.s15p21b103.good_tashu.claim.domain.ClaimStatus;
import java.time.LocalDateTime;
import java.util.List;

public record AdminClaimDetailResponse(
        Long claimId,
        String cycleId,
        Long userId,
        String nickname,
        LocalDateTime createdAt,
        String content,
        ClaimStatus statement,
        String adminComment,
        String photoUrl,
        List<AdminClaimReportResponse> report
) {
}
