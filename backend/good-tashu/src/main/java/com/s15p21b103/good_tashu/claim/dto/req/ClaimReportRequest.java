package com.s15p21b103.good_tashu.claim.dto.req;

import com.s15p21b103.good_tashu.claim.domain.ClaimReportCategory;
import jakarta.validation.constraints.NotNull;

public record ClaimReportRequest(
        @NotNull ClaimReportCategory claimCategory
) {
}
