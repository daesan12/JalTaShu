package com.s15p21b103.good_tashu.admin.dto.res;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AdminCycleStatisticsResponse(
        Long totalCycleCnt,
        @JsonProperty("RentCycleCnt") Long rentCycleCnt,
        @JsonProperty("WaitCycleCnt") Long waitCycleCnt,
        Long claimCycleCnt
) {
}
