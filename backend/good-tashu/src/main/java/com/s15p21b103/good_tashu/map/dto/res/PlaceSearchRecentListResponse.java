package com.s15p21b103.good_tashu.map.dto.res;

import java.math.BigDecimal;

public record PlaceSearchRecentListResponse(
        Long placeId,
        String title,
        String address,
        String roadAddress,
        BigDecimal xPos,
        BigDecimal yPos
) {
}
