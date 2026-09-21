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

import java.util.List;
import java.util.Map;

import static com.s15p21b103.good_tashu.map.exception.MapErrorCode.*;

@Service
@RequiredArgsConstructor
public class BikeStationService {
    private final StationRepository stations;
    private final BikeStationRealtimeRepository realtime;
    private final StationPredictionRepository predictions;

    public List<BikeStationListItem> list() {
        // 좌표와 이름은 MySQL 정류소 기본 정보가 기준이다.
        List<StationEntity> masters = stations.findAll();
        Map<String, CurrentStation> current = realtime.findAll(masters);
        // snapshot에 없는 대여소도 반환하고, 실시간 수량과 시각만 null로 둔다.
        return masters.stream()
                .sorted((a, b) -> a.getStationId().compareTo(b.getStationId()))
                .map(station -> {
                    CurrentStation live = current.get(station.getStationId());
                    return new BikeStationListItem(station.getStationId(), station.getName(),
                            station.getLongitude(), station.getLatitude(), station.getAddress(),
                            live == null ? null : live.currentCnt(), live == null ? null : live.time());
                })
                .toList();
    }

    public BikeStationDetailResponse detail(String stationId) {
        StationEntity master = stations.findById(stationId)
                .orElseThrow(() -> new MapException(BIKE_STATION_NOT_FOUND));
        CurrentStation current = realtime.findAll(List.of(master)).get(stationId);
        if (current == null) throw new MapException(BIKE_STATION_DATA_UNAVAILABLE);
        return new BikeStationDetailResponse(stationId, current.currentCnt(), current.time(),
                predictions.findNext60Minutes(stationId));
    }
}
