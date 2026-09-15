package com.s15p21b103.good_tashu.cycle.event;

import java.time.LocalDateTime;

public record CycleRentalStartedEvent(
        Long userId,
        LocalDateTime rentalAt
) {
}
