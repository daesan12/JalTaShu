package com.s15p21b103.good_tashu.cycle.dto.req;

import jakarta.validation.constraints.NotBlank;

public record CycleReturnRequest(
        @NotBlank String cycleId,
        @NotBlank String stationId
){
}
