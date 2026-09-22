package com.s15p21b103.good_tashu.map.service;

import com.s15p21b103.good_tashu.cycle.domain.StationEntity;
import com.s15p21b103.good_tashu.cycle.repository.StationRepository;
import com.s15p21b103.good_tashu.map.client.OsrmClient;
import com.s15p21b103.good_tashu.map.client.dto.OsrmResponse;
import com.s15p21b103.good_tashu.map.client.dto.RouteCoordinate;
import com.s15p21b103.good_tashu.map.domain.RouteType;
import com.s15p21b103.good_tashu.map.domain.StationStrategy;
import com.s15p21b103.good_tashu.map.repository.StationPredictionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PathServiceTest {
    private final StationRepository stations = mock(StationRepository.class);
    private final OsrmClient osrm = mock(OsrmClient.class);
    private final DemElevationService elevation = mock(DemElevationService.class);
    private final StationPredictionRepository predictions = mock(StationPredictionRepository.class);
    private ExecutorService executor;
    private PathService service;

    private final StationEntity nearest = station("N", "가까운 대여소", "36.3500", "127.3500");
    private final StationEntity secureNear = station("S1", "확보 후보 1", "36.3510", "127.3500");
    private final StationEntity secureBest = station("S2", "확보 후보 2", "36.3520", "127.3500");
    private final StationEntity destination = station("E", "반납 대여소", "36.3600", "127.3600");

    @BeforeEach
    void setUp() {
        executor = Executors.newFixedThreadPool(4);
        service = new PathService(stations, osrm, elevation, predictions, executor);
        when(stations.findAll()).thenReturn(List.of(nearest, secureNear, secureBest, destination));
        when(osrm.walkingDurations(any(), any(), anyBoolean())).thenAnswer(invocation -> {
            List<RouteCoordinate> points = invocation.getArgument(1);
            boolean fromStart = invocation.getArgument(2);
            return points.stream().map(point -> duration(point, fromStart)).toList();
        });
        when(osrm.route(any(), any(), any())).thenReturn(route());
    }

    @AfterEach
    void tearDown() {
        executor.shutdownNow();
    }

    @Test
    void returnsNormalAndBikeSecureProfilesUsingDifferentRentalStations() {
        when(predictions.findBikeCount("N", 1)).thenReturn(new BigDecimal("0.4"));
        when(predictions.findBikeCount("S1", 4)).thenReturn(new BigDecimal("2.0"));
        when(predictions.findBikeCount("S2", 5)).thenReturn(new BigDecimal("4.0"));
        when(predictions.findBikeCount("S1", 1)).thenReturn(new BigDecimal("2.0"));
        when(predictions.findBikeCount("S2", 1)).thenReturn(new BigDecimal("4.0"));

        var routes = service.buildResponse(
                new BigDecimal("36.3500"), new BigDecimal("127.3500"),
                new BigDecimal("36.3600"), new BigDecimal("127.3600")).routes();

        assertThat(routes).hasSize(4);
        assertThat(routes.subList(0, 2))
                .allMatch(route -> route.stationStrategy() == StationStrategy.NEAREST)
                .extracting(route -> route.type())
                .containsExactly(RouteType.BIKE, RouteType.UPHILL);
        assertThat(routes.subList(0, 2))
                .allMatch(route -> route.startStation().stationId().equals("N"));
        assertThat(routes.subList(2, 4))
                .allMatch(route -> route.stationStrategy() == StationStrategy.BIKE_SECURE)
                .allMatch(route -> route.startStation().stationId().equals("S2"))
                .extracting(route -> route.type())
                .containsExactly(RouteType.BIKE, RouteType.UPHILL);
    }

    @Test
    void omitsDuplicateSecureRoutesWhenNoOtherStationHasAtLeastOneBike() {
        when(predictions.findBikeCount(any(), any(Integer.class))).thenReturn(new BigDecimal("0.9"));

        var routes = service.buildResponse(
                new BigDecimal("36.3500"), new BigDecimal("127.3500"),
                new BigDecimal("36.3600"), new BigDecimal("127.3600")).routes();

        assertThat(routes).hasSize(2);
        assertThat(routes).allMatch(route -> route.stationStrategy() == StationStrategy.NEAREST);
    }

    private double duration(RouteCoordinate point, boolean fromStart) {
        if (fromStart) {
            if (point.longitude() == 127.3500 && point.latitude() == 36.3500) return 60;
            if (point.longitude() == 127.3500 && point.latitude() == 36.3510) return 240;
            if (point.longitude() == 127.3500 && point.latitude() == 36.3520) return 300;
            return 1_200;
        }
        if (point.longitude() == 127.3600 && point.latitude() == 36.3600) return 60;
        return 1_000;
    }

    private StationEntity station(String id, String name, String latitude, String longitude) {
        return StationEntity.builder()
                .stationId(id)
                .name(name)
                .latitude(new BigDecimal(latitude))
                .longitude(new BigDecimal(longitude))
                .build();
    }

    private OsrmResponse.Route route() {
        var coordinates = List.of(List.of(127.3500, 36.3500), List.of(127.3510, 36.3510));
        var maneuver = new OsrmResponse.Maneuver("depart", null, coordinates.getFirst(), null);
        var step = new OsrmResponse.Step(100.0, 60.0, "테스트 도로", "cycling",
                new OsrmResponse.Geometry("LineString", coordinates), maneuver);
        return new OsrmResponse.Route(100.0, 60.0,
                List.of(new OsrmResponse.Leg(List.of(step))));
    }
}
