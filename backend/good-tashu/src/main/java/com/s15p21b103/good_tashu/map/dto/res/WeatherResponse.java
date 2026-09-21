package com.s15p21b103.good_tashu.map.dto.res;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record WeatherResponse(
        OffsetDateTime observedAt,
        BigDecimal temperature,
        BigDecimal rainfall1h
) {}
