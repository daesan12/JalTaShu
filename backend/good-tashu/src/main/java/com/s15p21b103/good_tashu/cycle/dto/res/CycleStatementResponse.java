package com.s15p21b103.good_tashu.cycle.dto.res;

import java.time.LocalDateTime;

public record CycleStatementResponse(
        String cycleId,
        boolean rideable,
        LocalDateTime lastUsedAt,
        String lastStationName
) {
}
