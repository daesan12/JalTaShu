package com.s15p21b103.good_tashu.map.client.dto;

import java.util.List;

/** OSRM/GeoJSON coordinate order is longitude, latitude. */
public record RouteCoordinate(double longitude, double latitude) {
    public boolean isValid() {
        return Double.isFinite(longitude) && Double.isFinite(latitude)
                && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90;
    }

    public String toOsrm() {
        return longitude + "," + latitude;
    }

    public List<Double> toLocation() {
        return List.of(longitude, latitude);
    }
}
