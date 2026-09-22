package com.s15p21b103.good_tashu.path.domain;

import com.s15p21b103.good_tashu.map.domain.TravelStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.util.List;

public record PathInfo(@NotEmpty List<@NotNull @Valid PathPoint> road) {
    public record PathPoint(
            @NotNull @DecimalMin("-90") @DecimalMax("90")
            BigDecimal latitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180")
            BigDecimal longitude,
            @NotNull
            BigDecimal altitude,
            @NotNull
            TravelStatus travelStatus,
            @NotNull @PositiveOrZero
            Integer seq
    ) {
    }
}
