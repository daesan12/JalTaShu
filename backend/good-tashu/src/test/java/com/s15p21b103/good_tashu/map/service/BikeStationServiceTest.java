package com.s15p21b103.good_tashu.map.service;

import com.s15p21b103.good_tashu.cycle.domain.StationEntity;
import com.s15p21b103.good_tashu.cycle.repository.StationRepository;
import com.s15p21b103.good_tashu.map.dto.res.BikeStationForecastPoint;
import com.s15p21b103.good_tashu.map.repository.BikeStationRealtimeRepository;
import com.s15p21b103.good_tashu.map.repository.BikeStationRealtimeRepository.CurrentStation;
import com.s15p21b103.good_tashu.map.repository.StationPredictionRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class BikeStationServiceTest {
    private final StationRepository stations = mock(StationRepository.class);
    private final BikeStationRealtimeRepository realtime = mock(BikeStationRealtimeRepository.class);
    private final StationPredictionRepository predictions = mock(StationPredictionRepository.class);
    private final BikeStationService service = new BikeStationService(stations, realtime, predictions);

    private static StationEntity master(String id) {
        return master(id, "36.3500", "127.3800");
    }

    private static StationEntity master(String id, String latitude, String longitude) {
        return StationEntity.builder().stationId(id).name(id).address("MySQL address")
                .latitude(new BigDecimal(latitude))
                .longitude(new BigDecimal(longitude)).build();
    }

    private static CurrentStation current(String id, String latitude) {
        return new CurrentStation(id, id, null, null, new BigDecimal("127.3800"),
                new BigDecimal(latitude), null, 4, 4, "2026-09-18T12:30:00+09:00");
    }

    @Test
    void listReturnsAllMysqlStationsWithAvailableRedisCounts() {
        StationEntity first = master("ST0001", "36.3540", "127.3850");
        List<StationEntity> masters = List.of(master("ST0003", "36.3500", "127.3900"),
                first, master("ST0002", "36.3600", "127.3800"));
        when(stations.findAll()).thenReturn(masters);
        when(realtime.findAll(masters)).thenReturn(Map.of(
                "ST0001", current("ST0001", "36.3500"),
                "ST0003", current("ST0003", "36.3500")));

        var result = service.list();

        assertThat(result).extracting(item -> item.stationId())
                .containsExactly("ST0001", "ST0002", "ST0003");
        assertThat(result.getFirst().stationId()).isEqualTo("ST0001");
        assertThat(result.getFirst().yPos()).isEqualByComparingTo("36.3540");
        assertThat(result.getFirst().xPos()).isEqualByComparingTo("127.3850");
        assertThat(result.getFirst().address()).isEqualTo("MySQL address");
        assertThat(result.getFirst().time()).isEqualTo("2026-09-18T12:30:00+09:00");
        assertThat(result.getFirst().currentCnt()).isEqualTo(4);
        assertThat(result.get(1).currentCnt()).isNull();
        assertThat(result.get(1).time()).isNull();
        verify(realtime).findAll(masters);
    }

    @Test
    void detailReturnsAvailableForecastsAndCurrentCount() {
        StationEntity station = master("ST0001");
        when(stations.findById("ST0001")).thenReturn(Optional.of(station));
        when(realtime.findAll(List.of(station))).thenReturn(Map.of("ST0001", current("ST0001", "36.3500")));
        var point = new BikeStationForecastPoint(OffsetDateTime.parse("2026-09-18T12:35:00+09:00"),
                new BigDecimal("3.2"), new BigDecimal("0.125"));
        when(predictions.findNext15Minutes("ST0001")).thenReturn(List.of(point));

        var result = service.detail("ST0001");

        assertThat(result.currentCnt()).isEqualTo(4);
        assertThat(result.futureData()).containsExactly(point);
    }

}
