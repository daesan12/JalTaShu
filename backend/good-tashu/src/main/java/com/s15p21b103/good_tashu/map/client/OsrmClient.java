package com.s15p21b103.good_tashu.map.client;

import com.s15p21b103.good_tashu.map.client.dto.OsrmResponse;
import com.s15p21b103.good_tashu.map.client.dto.RouteCoordinate;
import com.s15p21b103.good_tashu.map.exception.MapException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static com.s15p21b103.good_tashu.map.exception.MapErrorCode.*;

@Component
public class OsrmClient {
    public enum Profile { FOOT, BIKE, UPHILL }
    private final RestClient restClient;
    private final ObjectMapper mapper;
    private final String footUrl;
    private final String bikeUrl;
    private final String uphillUrl;

    public OsrmClient(@Qualifier("osrmRestClient") RestClient restClient, ObjectMapper mapper,
                      @Value("${osrm.foot.base-url:http://localhost:5000}") String footUrl,
                      @Value("${osrm.bicycle.base-url:http://localhost:5001}") String bikeUrl,
                      @Value("${osrm.uphill.base-url:http://localhost:5002}") String uphillUrl) {
        this.restClient = restClient;
        this.mapper = mapper;
        this.footUrl = footUrl;
        this.bikeUrl = bikeUrl;
        this.uphillUrl = uphillUrl;
    }

    public OsrmResponse.Route route(Profile profile, RouteCoordinate from, RouteCoordinate to) {
        String url = switch (profile) {
            case FOOT -> footUrl;
            case BIKE -> bikeUrl;
            case UPHILL -> uphillUrl;
        };
        String name = profile.name().toLowerCase(java.util.Locale.ROOT);
        var uri = UriComponentsBuilder.fromUriString(url)
                .path("/route/v1/" + name + "/" + from.toOsrm() + ";" + to.toOsrm())
                .queryParam("steps", true).queryParam("geometries", "geojson")
                .queryParam("overview", "full").build().toUri();
        var response = request(uri);
        if (response.routes() == null || response.routes().isEmpty()) {
            throw new MapException(OSRM_RESPONSE_INVALID);
        }
        var route = response.routes().getFirst();
        if (route == null || !nonNegative(route.distance()) || !nonNegative(route.duration())
                || route.legs() == null || route.legs().isEmpty()) {
            throw new MapException(OSRM_RESPONSE_INVALID);
        }
        for (var leg : route.legs()) {
            if (leg == null || leg.steps() == null || leg.steps().isEmpty()) {
                throw new MapException(OSRM_RESPONSE_INVALID);
            }
            for (var step : leg.steps()) {
                if (step == null || !nonNegative(step.distance()) || !nonNegative(step.duration())
                        || step.geometry() == null || !"LineString".equals(step.geometry().type())
                        || step.geometry().coordinates() == null || step.geometry().coordinates().isEmpty()
                        || step.maneuver() == null || step.maneuver().type() == null
                        || !validLocation(step.maneuver().location())
                        || step.geometry().coordinates().stream().anyMatch(p -> !validLocation(p))) {
                    throw new MapException(OSRM_RESPONSE_INVALID);
                }
            }
        }
        return route;
    }

    /** null duration means the candidate is unreachable. Direction matters at the destination. */
    public List<Double> walkingDurations(RouteCoordinate endpoint, List<RouteCoordinate> stations,
                                         boolean fromEndpoint) {
        var coordinates = new ArrayList<RouteCoordinate>();
        coordinates.add(endpoint);
        coordinates.addAll(stations);
        String candidates = IntStream.rangeClosed(1, stations.size())
                .mapToObj(Integer::toString).collect(Collectors.joining(";"));
        var uri = UriComponentsBuilder.fromUriString(footUrl)
                .path("/table/v1/foot/" + coordinates.stream().map(RouteCoordinate::toOsrm)
                        .collect(Collectors.joining(";")))
                .queryParam("sources", fromEndpoint ? "0" : candidates)
                .queryParam("destinations", fromEndpoint ? candidates : "0")
                .queryParam("annotations", "duration").build().toUri();
        var matrix = request(uri).durations();
        int rows = fromEndpoint ? 1 : stations.size();
        int cols = fromEndpoint ? stations.size() : 1;
        if (matrix == null || matrix.size() != rows || matrix.stream().anyMatch(row ->
                row == null || row.size() != cols || row.stream().anyMatch(d -> d != null && !nonNegative(d)))) {
            throw new MapException(OSRM_RESPONSE_INVALID);
        }
        var times = new ArrayList<Double>();
        for (int i = 0; i < stations.size(); i++) {
            times.add(fromEndpoint ? matrix.getFirst().get(i) : matrix.get(i).getFirst());
        }
        return times;
    }

    private OsrmResponse request(URI uri) {
        try {
            String body = restClient.get().uri(uri).retrieve().body(String.class);
            if (body == null || body.isBlank()) throw new MapException(OSRM_RESPONSE_INVALID);
            var response = mapper.readValue(body, OsrmResponse.class);
            if (response == null || response.code() == null) throw new MapException(OSRM_RESPONSE_INVALID);
            if (isNoRoute(response.code())) throw new MapException(PATH_NOT_FOUND);
            if (!"Ok".equals(response.code())) throw new MapException(OSRM_API_ERROR);
            return response;
        } catch (RestClientResponseException e) {
            try {
                var error = mapper.readValue(e.getResponseBodyAsString(), OsrmResponse.class);
                if (error != null && isNoRoute(error.code())) throw new MapException(PATH_NOT_FOUND);
            } catch (JacksonException ignored) {
                // An upstream non-JSON error is still an OSRM availability failure.
            }
            throw new MapException(e.getStatusCode().value() == 504 ? OSRM_API_TIMEOUT : OSRM_API_ERROR, e);
        } catch (ResourceAccessException e) {
            for (Throwable cause = e; cause != null; cause = cause.getCause()) {
                if (cause instanceof HttpTimeoutException || cause instanceof SocketTimeoutException) {
                    throw new MapException(OSRM_API_TIMEOUT, e);
                }
            }
            throw new MapException(OSRM_API_ERROR, e);
        } catch (RestClientException | JacksonException e) {
            throw new MapException(OSRM_RESPONSE_INVALID, e);
        }
    }

    private boolean isNoRoute(String code) {
        return "NoRoute".equals(code) || "NoSegment".equals(code) || "NoTable".equals(code);
    }

    private boolean nonNegative(Double value) {
        return value != null && Double.isFinite(value) && value >= 0;
    }

    private boolean validLocation(List<Double> point) {
        return point != null && point.size() == 2 && point.get(0) != null && point.get(1) != null
                && new RouteCoordinate(point.get(0), point.get(1)).isValid();
    }
}
