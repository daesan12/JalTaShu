package com.s15p21b103.good_tashu.cycle.dto.req;

import com.s15p21b103.good_tashu.cycle.domain.ClaimReportCategory;
import jakarta.validation.constraints.NotNull;

public record CycleClaimReportRequest(
        @NotNull ClaimReportCategory claimCategory
) {
}
