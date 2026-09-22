package com.s15p21b103.good_tashu.admin.dto.res;

import com.s15p21b103.good_tashu.cycle.domain.CycleStatus;

import java.time.LocalDateTime;

public record AdminCycleListResponse(
        String cycleId,
        String currentLocation,
        CycleStatus statement,
        LocalDateTime recentUsingAt,
        Long claimCnt
) {
}
