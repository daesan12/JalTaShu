package com.s15p21b103.good_tashu.map.dto.res;

import com.s15p21b103.good_tashu.map.domain.RouteType;
import com.s15p21b103.good_tashu.map.domain.StationStrategy;

import java.math.BigDecimal;
import java.util.List;

/** Distances/altitudes are metres, times are seconds, locations are [longitude, latitude]. */
public record PathResponseDto(List<Route> routes) {
    public enum TravelMode { WALK, BICYCLE }

    public record Station(String stationId, String name, List<Double> location) {}

    public record Route(RouteType type, StationStrategy stationStrategy,
                        Station startStation, Station endStation, BigDecimal expectedBikeCnt,
                        double totalDistance, double totalTime, List<Leg> legs) {}

    /** A service leg is a travel-mode section, not an OSRM waypoint leg. */
    public record Leg(TravelMode mode, double distance, double time, List<Step> steps) {}

    public record Step(double distance, double time, String roadName, String travelMode,
                       List<Point> points, Behave behave) {}

    public record Point(List<Double> location, double altitude) {}

    /** Action is performed at the START of the step. Keep raw OSRM type/modifier/exit. */
    public record Behave(String type, String modifier, Integer exit,
                         List<Double> location, String instruction) {}
}
