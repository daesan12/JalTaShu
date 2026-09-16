package com.s15p21b103.good_tashu.admin.dto.res;

public record AdminCycleStatisticsResponse(
        Long totalCycleCnt,
        Long rentCycleCnt,
        Long waitCycleCnt,
        Long claimCycleCnt
) {
}
