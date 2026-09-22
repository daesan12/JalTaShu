package com.s15p21b103.good_tashu.cycle.dto.req;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

import java.math.BigDecimal;

public record CycleRentalRequest(
        @NotBlank
        @Pattern(regexp = "^[A-Za-z0-9]{6,12}$", message = "자전거 번호 형식이 올바르지 않습니다.")
        String cycleId,
        @NotBlank String stationId,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal latitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal longitude
) {
}
