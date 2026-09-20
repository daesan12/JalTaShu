package com.s15p21b103.good_tashu.map.service;

import com.s15p21b103.good_tashu.cycle.domain.StationEntity;
import com.s15p21b103.good_tashu.cycle.repository.StationRepository;
import com.s15p21b103.good_tashu.map.client.OsrmClient;
import com.s15p21b103.good_tashu.map.client.dto.OsrmResponse;
import com.s15p21b103.good_tashu.map.client.dto.RouteCoordinate;
import com.s15p21b103.good_tashu.map.domain.RouteType;
import com.s15p21b103.good_tashu.map.domain.TravelStatus;
import com.s15p21b103.good_tashu.map.dto.res.PathResponseDto;
import com.s15p21b103.good_tashu.map.exception.MapException;
import com.s15p21b103.good_tashu.map.repository.StationPredictionRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.function.Supplier;

import static com.s15p21b103.good_tashu.map.client.OsrmClient.Profile.*;
import static com.s15p21b103.good_tashu.map.dto.res.PathResponseDto.*;
import static com.s15p21b103.good_tashu.map.exception.MapErrorCode.*;

@Service
public class PathService {
    private static final int CANDIDATE_COUNT = 5;
    private final StationRepository stationRepository;
    private final OsrmClient osrm;
    private final DemElevationService elevation;
    private final StationPredictionRepository predictions;
    private final ExecutorService executor;

    public PathService(StationRepository stations, OsrmClient osrm, DemElevationService elevation,
                       StationPredictionRepository predictions,
                       @Qualifier("osrmExecutor") ExecutorService executor) {
        this.stationRepository = stations;
        this.osrm = osrm;
        this.elevation = elevation;
        this.predictions = predictions;
        this.executor = executor;
    }

    // No enclosing DB transaction: network requests should not hold a database connection.
    public PathResponseDto buildResponse(BigDecimal startLat, BigDecimal startLng,
                                         BigDecimal endLat, BigDecimal endLng) {
        var start = coordinate(startLat, startLng);
        var end = coordinate(endLat, endLng);
        
        // 모든 대여소를 가져옴(위도, 경도가 유효한)
        var available = stationRepository.findAll().stream()
                .filter(s -> s.getLatitude() != null && s.getLongitude() != null)
                .filter(s -> stationCoordinate(s).isValid()).toList();
        // 유효한 대여소가 없으면 예외
        if (available.isEmpty()) throw new MapException(PATH_STATION_NOT_FOUND);

        // 출발지와 가장 가까운 대여소 후보 5개
        List<StationEntity> starts = nearest(start, available);
        // 종착지와 가장 가까운 대여소 후보 5개
        List<StationEntity> ends = nearest(end, available);
        
        // 비동기로 출발지->대여소 별 시간과 대여소->도착지의 시간을 구함
        var startTimes = async(() -> osrm.walkingDurations(start, points(starts), true));
        var endTimes = async(() -> osrm.walkingDurations(end, points(ends), false));
        awaitAll(startTimes, endTimes);
        
        // 각 대여소 별 시간별 오름차순 정렬
        var rankedStarts = reachable(starts, startTimes.join());
        var rankedEnds = reachable(ends, endTimes.join());
        if (rankedStarts.isEmpty() || rankedEnds.isEmpty()) throw new MapException(PATH_NOT_FOUND);

        // Renting and returning at the same station adds no useful cycling section.
        // 가장 가까운 대여소와 반납소가 같으면 걸어가라
        if (sameStation(rankedStarts.getFirst().station, rankedEnds.getFirst().station)) {
            Leg walk = toLeg(TravelMode.WALK, osrm.route(FOOT, start, end));
            return new PathResponseDto(List.of(combine(RouteType.WALK, null, null, null, List.of(walk))));
        }

        // 각 대여소별 짝
        var pairs = new ArrayList<Pair>();
        for (var from : rankedStarts) {
            for (var to : rankedEnds) {
                if (!sameStation(from.station, to.station)) pairs.add(new Pair(from, to));
            }
        }
        pairs.sort(Comparator.comparingDouble(p -> p.from.time + p.to.time));
        // Cache shared sections when a disconnected bike pair requires the next candidate pair.
        var walkingFrom = new HashMap<String, CompletableFuture<OsrmResponse.Route>>();
        var walkingTo = new HashMap<String, CompletableFuture<OsrmResponse.Route>>();
        for (var pair : pairs) {
            var from = pair.from.station;
            var to = pair.to.station;
            // 시작과 끝 대여소가 같으면 continue;
            if(from.getStationId().equals(to.getStationId())) continue;
            var fromPoint = stationCoordinate(from);
            var toPoint = stationCoordinate(to);
            var first = walkingFrom.computeIfAbsent(from.getStationId(),
                    id -> async(() -> osrm.route(FOOT, start, fromPoint)));
            var last = walkingTo.computeIfAbsent(to.getStationId(),
                    id -> async(() -> osrm.route(FOOT, toPoint, end)));
            var bike = async(() -> osrm.route(BIKE, fromPoint, toPoint));
            var uphill = async(() -> osrm.route(UPHILL, fromPoint, toPoint));
            try {
                awaitAll(first, last, bike, uphill);
            } catch (MapException e) {
                if (e.getErrorCode() == PATH_NOT_FOUND) continue;
                throw e;
            }
            Leg access = toLeg(TravelMode.WALK, first.join());
            Leg egress = toLeg(TravelMode.WALK, last.join());
            Station origin = stationDto(from), destination = stationDto(to);
            BigDecimal expectedBikeCnt = expectedBikeCount(from.getStationId(), access.time());
            return new PathResponseDto(List.of(
                    combine(RouteType.BIKE, origin, destination, expectedBikeCnt,
                            List.of(access, toLeg(TravelMode.BICYCLE, bike.join()), egress)),
                    combine(RouteType.UPHILL, origin, destination, expectedBikeCnt,
                            List.of(access, toLeg(TravelMode.BICYCLE, uphill.join()), egress))));
        }
        throw new MapException(PATH_NOT_FOUND);
    }

    // 이미 선택한 정류소를 유지하며 아직 이동하지 않은 구간만 재탐색한다.
    public PathResponseDto buildReRouteResponse(BigDecimal startLat, BigDecimal startLng,
                                                BigDecimal endLat, BigDecimal endLng,
                                                String startStationId, String endStationId,
                                                TravelStatus travelStatus, RouteType routeType) {
        var start = coordinate(startLat, startLng);
        var end = coordinate(endLat, endLng);
        if (travelStatus == null || routeType == null) throw new MapException(INVALID_REROUTE_REQUEST);

        if (routeType == RouteType.WALK || travelStatus == TravelStatus.WALK2) {
            var walk = toLeg(TravelMode.WALK, osrm.route(FOOT, start, end));
            return new PathResponseDto(List.of(combine(RouteType.WALK, null, null, null, List.of(walk))));
        }

        if (endStationId == null || endStationId.isBlank()
                || (travelStatus == TravelStatus.WALK1 && (startStationId == null || startStationId.isBlank()))) {
            throw new MapException(INVALID_REROUTE_REQUEST);
        }
        StationEntity destination = requireStation(endStationId);
        StationEntity origin = travelStatus == TravelStatus.WALK1 ? requireStation(startStationId) : null;
        var bikeStart = origin == null ? start : stationCoordinate(origin);
        var bikeEnd = stationCoordinate(destination);
        var profile = routeType == RouteType.UPHILL ? UPHILL : BIKE;

        var access = origin == null ? null : async(() -> osrm.route(FOOT, start, bikeStart));
        var bike = async(() -> osrm.route(profile, bikeStart, bikeEnd));
        var egress = async(() -> osrm.route(FOOT, bikeEnd, end));
        if (access == null) awaitAll(bike, egress);
        else awaitAll(access, bike, egress);

        var legs = new ArrayList<Leg>();
        if (access != null) legs.add(toLeg(TravelMode.WALK, access.join()));
        legs.add(toLeg(TravelMode.BICYCLE, bike.join()));
        legs.add(toLeg(TravelMode.WALK, egress.join()));
        BigDecimal expectedBikeCnt = origin == null ? null
                : expectedBikeCount(origin.getStationId(), legs.getFirst().time());
        return new PathResponseDto(List.of(combine(routeType,
                origin == null ? null : stationDto(origin), stationDto(destination), expectedBikeCnt,
                List.copyOf(legs))));
    }

    private StationEntity requireStation(String stationId) {
        return stationRepository.findById(stationId)
                .filter(s -> s.getLatitude() != null && s.getLongitude() != null)
                .filter(s -> stationCoordinate(s).isValid())
                .orElseThrow(() -> new MapException(PATH_STATION_NOT_FOUND));
    }

    private List<StationEntity> nearest(RouteCoordinate point, List<StationEntity> candidates) {
        return candidates.stream().sorted(Comparator
                        .comparingDouble((StationEntity s) -> haversine(point, stationCoordinate(s)))
                        .thenComparing(StationEntity::getStationId))
                .limit(CANDIDATE_COUNT).toList();
    }

    // 하버사인 공식
    private double haversine(RouteCoordinate a, RouteCoordinate b) {
        double lat = Math.toRadians(b.latitude() - a.latitude());
        double lon = Math.toRadians(b.longitude() - a.longitude());
        double h = Math.pow(Math.sin(lat / 2), 2) + Math.cos(Math.toRadians(a.latitude()))
                * Math.cos(Math.toRadians(b.latitude())) * Math.pow(Math.sin(lon / 2), 2);
        return 2 * 6_371_000 * Math.asin(Math.sqrt(Math.clamp(h, 0, 1)));
    }


    // 시간순 정렬
    private List<Candidate> reachable(List<StationEntity> candidates, List<Double> times) {
        var result = new ArrayList<Candidate>();
        for (int i = 0; i < candidates.size(); i++) {
            if (times.get(i) != null) result.add(new Candidate(candidates.get(i), times.get(i)));
        }
        result.sort(Comparator.comparingDouble(Candidate::time)
                .thenComparing(c -> c.station.getStationId()));
        return result;
    }

    // step으로 Leg 만들기
    private Leg toLeg(TravelMode mode, OsrmResponse.Route route) {
        List<Step> steps = route.legs().stream().flatMap(leg -> leg.steps().stream()).map(step -> {
            List<Point> points = step.geometry().coordinates().stream()
                    .map(p -> new Point(List.copyOf(p), elevation.elevation(p.get(0), p.get(1)))).toList();
            var action = step.maneuver();
            var behave = new Behave(action.type(), action.modifier(), action.exit(),
                    List.copyOf(action.location()), instruction(action));
            return new Step(step.distance(), step.duration(), step.name(), step.mode(), points, behave);
        }).toList();
        return new Leg(mode, route.distance(), route.duration(), steps);
    }

    private String instruction(OsrmResponse.Maneuver action) {
        String direction = switch (Objects.toString(action.modifier(), "")) {
            case "left" -> "좌회전하세요";
            case "right" -> "우회전하세요";
            case "slight left" -> "왼쪽으로 완만하게 이동하세요";
            case "slight right" -> "오른쪽으로 완만하게 이동하세요";
            case "sharp left" -> "왼쪽으로 크게 꺾으세요";
            case "sharp right" -> "오른쪽으로 크게 꺾으세요";
            case "uturn" -> "유턴하세요";
            default -> "직진하세요";
        };
        return switch (action.type()) {
            case "depart" -> "출발하세요";
            case "arrive" -> "구간 목적지에 도착했습니다";
            case "roundabout", "rotary" -> action.exit() == null ? "회전교차로로 진입하세요"
                    : "회전교차로에서 " + action.exit() + "번째 출구로 나가세요";
            case "exit roundabout", "exit rotary" -> "회전교차로에서 나가세요";
            case "fork" -> "갈림길에서 " + direction;
            case "notification" -> "이동 방식 변경을 확인하세요";
            default -> direction;
        };
    }

    private Route combine(RouteType type, Station from, Station to, BigDecimal expectedBikeCnt, List<Leg> legs) {
        return new Route(type, from, to, expectedBikeCnt, legs.stream().mapToDouble(Leg::distance).sum(),
                legs.stream().mapToDouble(Leg::time).sum(), legs);
    }

    private BigDecimal expectedBikeCount(String stationId, double walkingSeconds) {
        if (!Double.isFinite(walkingSeconds) || walkingSeconds < 0) return null;
        int horizonMinutes = Math.max(1, (int) Math.ceil(walkingSeconds / 60.0));
        return predictions.findBikeCount(stationId, horizonMinutes);
    }

    private Station stationDto(StationEntity station) {
        return new Station(station.getStationId(), station.getName(), stationCoordinate(station).toLocation());
    }

    private boolean sameStation(StationEntity a, StationEntity b) {
        return a.getStationId().equals(b.getStationId());
    }

    private RouteCoordinate coordinate(BigDecimal lat, BigDecimal lon) {
        if (lat == null || lon == null) throw new MapException(INVALID_PATH_COORDINATES);
        var point = new RouteCoordinate(lon.doubleValue(), lat.doubleValue());
        if (!point.isValid()) throw new MapException(INVALID_PATH_COORDINATES);
        return point;
    }

    private RouteCoordinate stationCoordinate(StationEntity station) {
        return new RouteCoordinate(station.getLongitude().doubleValue(), station.getLatitude().doubleValue());
    }

    private List<RouteCoordinate> points(List<StationEntity> values) {
        return values.stream().map(this::stationCoordinate).toList();
    }

    private <T> CompletableFuture<T> async(Supplier<T> task) {
        return CompletableFuture.supplyAsync(task, executor);
    }

    private void awaitAll(CompletableFuture<?>... tasks) {
        // Wait for all tasks before trying another pair; surface infrastructure errors first.
        try {
            CompletableFuture.allOf(tasks).join();
        } catch (CompletionException ignored) {
            MapException noRoute = null;
            for (var task : tasks) {
                try {
                    task.join();
                } catch (CompletionException e) {
                    if (e.getCause() instanceof MapException mapException) {
                        if (mapException.getErrorCode() != PATH_NOT_FOUND) throw mapException;
                        noRoute = mapException;
                    } else {
                        throw new MapException(OSRM_API_ERROR);
                    }
                }
            }
            if (noRoute != null) throw noRoute;
        }
    }

    private record Candidate(StationEntity station, double time) {}
    private record Pair(Candidate from, Candidate to) {}
}
