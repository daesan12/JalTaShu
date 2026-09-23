package com.s15p21b103.good_tashu.cycle.dto.res;

import java.time.LocalDateTime;

public record CycleCurrentRentalResponse(
        String cycleId,
        LocalDateTime rentedAt
) {
}
