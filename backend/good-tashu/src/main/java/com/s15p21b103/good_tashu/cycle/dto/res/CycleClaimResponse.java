package com.s15p21b103.good_tashu.cycle.dto.res;

import jakarta.validation.constraints.NotBlank;

public record CycleClaimResponse(
        @NotBlank Long claimId
) {
}
