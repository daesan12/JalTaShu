package com.s15p21b103.good_tashu.map.dto.res;

import java.math.BigDecimal;

public record BikeStationListItem(
        String stationId, String name,
        BigDecimal xPos, BigDecimal yPos, String address,
        Integer currentCnt, String time
) {}
