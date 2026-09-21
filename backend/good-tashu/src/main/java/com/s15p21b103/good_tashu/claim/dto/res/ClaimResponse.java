package com.s15p21b103.good_tashu.claim.dto.res;

import jakarta.validation.constraints.NotBlank;

public record ClaimResponse(
        @NotBlank Long claimId
) {
}
