package com.s15p21b103.good_tashu.map.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record NaverPlaceItem(
        String title,
        String address,
        String roadAddress,
        String mapx,
        String mapy
) {
}
