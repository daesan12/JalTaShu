package com.s15p21b103.good_tashu.cycle.dto.req;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CycleRentalRequest(
        @NotBlank
        @Pattern(regexp = "^[A-Za-z0-9]{6,12}$", message = "자전거 번호 형식이 올바르지 않습니다.")
        String cycleId,
        String stationId
) {
}
