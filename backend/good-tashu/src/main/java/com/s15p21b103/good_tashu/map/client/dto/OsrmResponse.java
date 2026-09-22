package com.s15p21b103.good_tashu.map.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OsrmResponse(String code, List<Route> routes, List<List<Double>> durations) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Route(Double distance, Double duration, List<Leg> legs) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Leg(List<Step> steps) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Step(Double distance, Double duration, String name, String mode,
                       Geometry geometry, Maneuver maneuver) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Geometry(String type, List<List<Double>> coordinates) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Maneuver(String type, String modifier, List<Double> location,
                           Integer exit) {}
}
