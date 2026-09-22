package com.s15p21b103.good_tashu.map.dto.res;

import java.util.List;

public record BikeStationDetailResponse(
        String stationId, Integer currentCnt, String time,
        List<BikeStationForecastPoint> futureData
) {}
