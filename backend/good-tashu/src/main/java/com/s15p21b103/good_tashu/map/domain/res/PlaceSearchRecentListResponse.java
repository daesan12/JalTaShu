package com.s15p21b103.good_tashu.map.domain.res;

import java.math.BigDecimal;

public record PlaceSearchRecentListResponse(
        String title,
        String address,
        String roadAddress,
        BigDecimal xPos,
        BigDecimal yPos
) {
}
