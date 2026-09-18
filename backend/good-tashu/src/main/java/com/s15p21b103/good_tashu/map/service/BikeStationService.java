package com.s15p21b103.good_tashu.map.service;

import com.s15p21b103.good_tashu.cycle.domain.StationEntity;
import com.s15p21b103.good_tashu.cycle.repository.StationRepository;
import com.s15p21b103.good_tashu.map.dto.res.BikeStationDetailResponse;
import com.s15p21b103.good_tashu.map.dto.res.BikeStationListItem;
import com.s15p21b103.good_tashu.map.exception.MapException;
import com.s15p21b103.good_tashu.map.repository.BikeStationRealtimeRepository;
import com.s15p21b103.good_tashu.map.repository.BikeStationRealtimeRepository.CurrentStation;
import com.s15p21b103.good_tashu.map.repository.StationPredictionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static com.s15p21b103.good_tashu.map.exception.MapErrorCode.*;

@Service
@RequiredArgsConstructor
public class BikeStationService {
    private static final double EARTH_RADIUS_METERS = 6_371_000;
    private static final int MAX_RANGE_METERS = 20_000;

    private final StationRepository stations;
    private final BikeStationRealtimeRepository realtime;
    private final StationPredictionRepository predictions;

    public List<BikeStationListItem> list(BigDecimal lat, BigDecimal lng, Integer range) {
        if (lat == null || lng == null || range == null || range < 1 || range > MAX_RANGE_METERS
                || lat.doubleValue() < -90 || lat.doubleValue() > 90
                || lng.doubleValue() < -180 || lng.doubleValue() > 180) {
            throw new MapException(INVALID_BIKE_STATION_RANGE);
        }
        double centerLat = lat.doubleValue();
        double centerLng = lng.doubleValue();
        // 미터 단위 반경을 위도·경도별 각도 범위로 바꿔 사각형의 네 변을 판정한다.
        double latitudeRange = Math.toDegrees((double) range / EARTH_RADIUS_METERS);
        double cosine = Math.cos(Math.toRadians(centerLat));
        double longitudeRange = cosine <= 0 ? 180
                : Math.min(180, Math.toDegrees(range / (EARTH_RADIUS_METERS * cosine)));
        // 좌표와 이름은 MySQL 정류소 기본 정보가 기준이다.
        List<StationEntity> nearby = stations.findAll().stream()
                .filter(station -> station.getLatitude() != null && station.getLongitude() != null)
                .filter(station -> Math.abs(station.getLatitude().doubleValue() - centerLat) <= latitudeRange
                        && longitudeDifference(station.getLongitude().doubleValue(), centerLng) <= longitudeRange)
                .toList();
        Map<String, CurrentStation> current = realtime.findAll(nearby);
        // Redis snapshot에 없는 대여소는 실시간 수량을 알 수 없어 목록에서 제외한다.
        return nearby.stream()
                .filter(station -> current.containsKey(station.getStationId()))
                .sorted((a, b) -> a.getStationId().compareTo(b.getStationId()))
                .map(station -> {
                    CurrentStation live = current.get(station.getStationId());
                    return new BikeStationListItem(station.getStationId(), station.getName(),
                            station.getLongitude(), station.getLatitude(), station.getAddress(),
                            live.currentCnt(), live.time());
                })
                .toList();
    }

    public BikeStationDetailResponse detail(String stationId) {
        StationEntity master = stations.findById(stationId)
                .orElseThrow(() -> new MapException(BIKE_STATION_NOT_FOUND));
        CurrentStation current = realtime.findAll(List.of(master)).get(stationId);
        if (current == null) throw new MapException(BIKE_STATION_DATA_UNAVAILABLE);
        return new BikeStationDetailResponse(stationId, current.currentCnt(), current.time(),
                predictions.findNext15Minutes(stationId));
    }

    private static double longitudeDifference(double longitude, double center) {
        // 날짜 변경선을 가로지르는 좌표도 짧은 쪽 경도 차이로 비교한다.
        double difference = Math.abs(longitude - center);
        return Math.min(difference, 360 - difference);
    }
}
