package com.s15p21b103.good_tashu.admin.dto.res;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AdminHeatmapResponse(
        LocalDateTime time,
        String stationId,
        String stationName,
        BigDecimal xPos,
        BigDecimal yPos,
        Long rentCnt,
        Long returnCnt
) {
}
