package com.s15p21b103.good_tashu.admin.dto.req;

import com.s15p21b103.good_tashu.claim.domain.ClaimStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AdminCycleClaimUpdateRequest(
        @NotNull ClaimStatus statement,
        // 관리자 코멘트로 저장할 내용
        @Size(max = 255) String content
) {
}
