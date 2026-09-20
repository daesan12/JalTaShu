package com.s15p21b103.good_tashu.map.dto.res;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record BikeStationForecastPoint(OffsetDateTime dateTime, BigDecimal bikeCnt, BigDecimal probOut) {}
