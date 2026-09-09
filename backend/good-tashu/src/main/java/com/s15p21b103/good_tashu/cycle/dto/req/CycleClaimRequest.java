package com.s15p21b103.good_tashu.cycle.dto.req;

import com.s15p21b103.good_tashu.cycle.domain.Category;
import jakarta.validation.constraints.NotBlank;

public record CycleClaimRequest(
        @NotBlank String cycleId,
        @NotBlank Category category,
        @NotBlank String content
) {
}
