package com.s15p21b103.good_tashu.map.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record NaverPlaceResponse(List<NaverPlaceItem> items) {
}
