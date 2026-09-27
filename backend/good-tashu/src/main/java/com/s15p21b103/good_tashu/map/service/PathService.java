package com.s15p21b103.good_tashu.map.service;

import com.s15p21b103.good_tashu.cycle.domain.StationEntity;
import com.s15p21b103.good_tashu.cycle.repository.StationRepository;
import com.s15p21b103.good_tashu.map.client.OsrmClient;
import com.s15p21b103.good_tashu.map.client.dto.OsrmResponse;
import com.s15p21b103.good_tashu.map.client.dto.RouteCoordinate;
import com.s15p21b103.good_tashu.map.domain.RouteType;
import com.s15p21b103.good_tashu.map.domain.StationStrategy;
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
    private static final int SECURE_CANDIDATE_COUNT = 10;
    private static final double SECURE_SEARCH_RADIUS_METERS = 1_500;
    /** Keep the response metric aligned with osrm-uphill/config.lua. */
    private static final double ELEVATION_SAMPLE_STEP_METERS = 15.0;
    private static final BigDecimal MIN_SECURE_BIKE_COUNT = BigDecimal.ONE;
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

        // 일반 경로는 가까운 5개, 확보 우선 경로는 반경 1.5km 안의 가까운 10개를 검토한다.
        List<StationEntity> starts = nearest(start, available, CANDIDATE_COUNT);
        List<StationEntity> secureStarts = withinRadius(start, available,
                SECURE_SEARCH_RADIUS_METERS, SECURE_CANDIDATE_COUNT);
        // 종착지와 가장 가까운 대여소 후보 5개
        List<StationEntity> ends = nearest(end, available, CANDIDATE_COUNT);

        // 두 출발 후보군이 겹치므로 합쳐서 OSRM 도보 시간 행렬을 한 번만 요청한다.
        var allStartsById = new LinkedHashMap<String, StationEntity>();
        starts.forEach(station -> allStartsById.put(station.getStationId(), station));
        secureStarts.forEach(station -> allStartsById.put(station.getStationId(), station));
        List<StationEntity> allStarts = List.copyOf(allStartsById.values());
        
        // 비동기로 출발지->대여소 별 시간과 대여소->도착지의 시간을 구함
        var startTimes = async(() -> osrm.walkingDurations(start, points(allStarts), true));
        var endTimes = async(() -> osrm.walkingDurations(end, points(ends), false));
        awaitAll(startTimes, endTimes);
        
        // 각 대여소 별 시간별 오름차순 정렬
        var rankedAllStarts = reachable(allStarts, startTimes.join());
        Set<String> normalStartIds = stationIds(starts);
        Set<String> secureStartIds = stationIds(secureStarts);
        var rankedStarts = rankedAllStarts.stream()
                .filter(candidate -> normalStartIds.contains(candidate.station.getStationId())).toList();
        var rankedSecureStarts = rankedAllStarts.stream()
                .filter(candidate -> secureStartIds.contains(candidate.station.getStationId())).toList();
        var rankedEnds = reachable(ends, endTimes.join());
        if (rankedStarts.isEmpty() || rankedEnds.isEmpty()) throw new MapException(PATH_NOT_FOUND);

        // Renting and returning at the same station adds no useful cycling section.
        // 가장 가까운 대여소와 반납소가 같으면 걸어가라
        if (sameStation(rankedStarts.getFirst().station, rankedEnds.getFirst().station)) {
            Leg walk = toLeg(TravelMode.WALK, osrm.route(FOOT, start, end));
            return new PathResponseDto(List.of(combine(RouteType.WALK, StationStrategy.NEAREST,
                    null, null, null, List.of(walk))));
        }

        // Cache shared sections when a disconnected bike pair requires the next candidate pair.
        var walkingFrom = new HashMap<String, CompletableFuture<OsrmResponse.Route>>();
        var walkingTo = new HashMap<String, CompletableFuture<OsrmResponse.Route>>();
        var normal = firstRoutable(pairByWalkingTime(rankedStarts, rankedEnds), StationStrategy.NEAREST,
                start, end, walkingFrom, walkingTo);
        if (normal == null) throw new MapException(PATH_NOT_FOUND);

        List<Route> routes = new ArrayList<>(normal.routes);
        String normalStartId = normal.pair.from.station.getStationId();

        // 확보 우선은 도착 시 예상 대수가 1대 이상인, 일반 경로와 다른 대여소를 고른다.
        Map<String, BigDecimal> secureCounts = new HashMap<>();
        var eligibleSecureStarts = rankedSecureStarts.stream()
                .filter(candidate -> !candidate.station.getStationId().equals(normalStartId))
                .filter(candidate -> {
                    BigDecimal count = expectedBikeCount(candidate.station.getStationId(), candidate.time);
                    if (count == null || count.compareTo(MIN_SECURE_BIKE_COUNT) < 0) return false;
                    secureCounts.put(candidate.station.getStationId(), count);
                    return true;
                }).toList();
        var securePairs = pairByWalkingTime(eligibleSecureStarts, rankedEnds);
        securePairs.sort(Comparator
                .<Pair, BigDecimal>comparing(pair -> secureCounts.get(pair.from.station.getStationId()),
                        Comparator.reverseOrder())
                .thenComparingDouble(pair -> pair.from.time + pair.to.time));
        var secure = firstRoutable(securePairs, StationStrategy.BIKE_SECURE,
                start, end, walkingFrom, walkingTo);
        if (secure != null) routes.addAll(secure.routes);

        return new PathResponseDto(List.copyOf(routes));
    }

    private SelectedRoutes firstRoutable(List<Pair> pairs, StationStrategy strategy,
                                         RouteCoordinate start, RouteCoordinate end,
                                         Map<String, CompletableFuture<OsrmResponse.Route>> walkingFrom,
                                         Map<String, CompletableFuture<OsrmResponse.Route>> walkingTo) {
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
            if (strategy == StationStrategy.BIKE_SECURE
                    && (expectedBikeCnt == null || expectedBikeCnt.compareTo(MIN_SECURE_BIKE_COUNT) < 0)) {
                continue;
            }
            return new SelectedRoutes(pair, List.of(
                    combine(RouteType.BIKE, strategy, origin, destination, expectedBikeCnt,
                            List.of(access, toLeg(TravelMode.BICYCLE, bike.join()), egress)),
                    combine(RouteType.UPHILL, strategy, origin, destination, expectedBikeCnt,
                            List.of(access, toLeg(TravelMode.BICYCLE, uphill.join()), egress))));
        }
        return null;
    }

    // 이미 선택한 정류소를 유지하며 아직 이동하지 않은 구간만 재탐색한다.
    public PathResponseDto buildReRouteResponse(BigDecimal startLat, BigDecimal startLng,
                                                BigDecimal endLat, BigDecimal endLng,
                                                String startStationId, String endStationId,
                                                TravelStatus travelStatus, RouteType routeType,
                                                StationStrategy stationStrategy) {
        var start = coordinate(startLat, startLng);
        var end = coordinate(endLat, endLng);
        if (travelStatus == null || routeType == null) throw new MapException(INVALID_REROUTE_REQUEST);

        if (routeType == RouteType.WALK || travelStatus == TravelStatus.WALK2) {
            var walk = toLeg(TravelMode.WALK, osrm.route(FOOT, start, end));
            return new PathResponseDto(List.of(combine(RouteType.WALK, StationStrategy.NEAREST,
                    null, null, null, List.of(walk))));
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
        return new PathResponseDto(List.of(combine(routeType, stationStrategy,
                origin == null ? null : stationDto(origin), stationDto(destination), expectedBikeCnt,
                List.copyOf(legs))));
    }

    private StationEntity requireStation(String stationId) {
        return stationRepository.findById(stationId)
                .filter(s -> s.getLatitude() != null && s.getLongitude() != null)
                .filter(s -> stationCoordinate(s).isValid())
                .orElseThrow(() -> new MapException(PATH_STATION_NOT_FOUND));
    }

    private List<StationEntity> nearest(RouteCoordinate point, List<StationEntity> candidates, int limit) {
        return candidates.stream().sorted(Comparator
                        .comparingDouble((StationEntity s) -> haversine(point, stationCoordinate(s)))
                        .thenComparing(StationEntity::getStationId))
                .limit(limit).toList();
    }

    private List<StationEntity> withinRadius(RouteCoordinate point, List<StationEntity> candidates,
                                             double radiusMeters, int limit) {
        return candidates.stream()
                .filter(station -> haversine(point, stationCoordinate(station)) <= radiusMeters)
                .sorted(Comparator
                        .comparingDouble((StationEntity station) -> haversine(point, stationCoordinate(station)))
                        .thenComparing(StationEntity::getStationId))
                .limit(limit)
                .toList();
    }

    private Set<String> stationIds(List<StationEntity> stations) {
        Set<String> ids = new HashSet<>();
        stations.forEach(station -> ids.add(station.getStationId()));
        return ids;
    }

    private List<Pair> pairByWalkingTime(List<Candidate> starts, List<Candidate> ends) {
        var pairs = new ArrayList<Pair>();
        for (var from : starts) {
            for (var to : ends) {
                if (!sameStation(from.station, to.station)) pairs.add(new Pair(from, to));
            }
        }
        pairs.sort(Comparator.comparingDouble(pair -> pair.from.time + pair.to.time));
        return pairs;
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

    private Route combine(RouteType type, StationStrategy stationStrategy,
                          Station from, Station to, BigDecimal expectedBikeCnt, List<Leg> legs) {
        return new Route(type, stationStrategy, from, to, expectedBikeCnt,
                legs.stream().mapToDouble(Leg::distance).sum(),
                legs.stream().mapToDouble(Leg::time).sum(), bicycleAscent(legs), legs);
    }

    /**
     * 누적 상승은 자전거 구간만 계산한다. OSRM 오르막 프로필과 같은 최대 15m 간격으로
     * DEM을 다시 샘플링해 응답 geometry의 점 개수에 따라 값이 달라지지 않게 한다.
     */
    private long bicycleAscent(List<Leg> legs) {
        double ascent = 0;
        for (Leg leg : legs) {
            if (leg.mode() != TravelMode.BICYCLE) continue;
            Point previous = null;
            for (Step step : leg.steps()) {
                for (Point current : step.points()) {
                    if (previous != null && !sameLocation(previous, current)) {
                        ascent += sampledAscent(previous, current);
                    }
                    previous = current;
                }
            }
        }
        return Math.round(ascent);
    }

    private double sampledAscent(Point from, Point to) {
        double fromLongitude = from.location().get(0);
        double fromLatitude = from.location().get(1);
        double toLongitude = to.location().get(0);
        double toLatitude = to.location().get(1);
        double distance = haversine(
                new RouteCoordinate(fromLongitude, fromLatitude),
                new RouteCoordinate(toLongitude, toLatitude));
        int samples = Math.max(1, (int) Math.ceil(distance / ELEVATION_SAMPLE_STEP_METERS));
        double previousElevation = from.altitude();
        double ascent = 0;
        for (int i = 1; i <= samples; i++) {
            double t = (double) i / samples;
            double currentElevation = i == samples ? to.altitude() : elevation.elevation(
                    fromLongitude + (toLongitude - fromLongitude) * t,
                    fromLatitude + (toLatitude - fromLatitude) * t);
            ascent += Math.max(0, currentElevation - previousElevation);
            previousElevation = currentElevation;
        }
        return ascent;
    }

    private boolean sameLocation(Point left, Point right) {
        return left.location().get(0).equals(right.location().get(0))
                && left.location().get(1).equals(right.location().get(1));
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
    private record SelectedRoutes(Pair pair, List<Route> routes) {}
}
