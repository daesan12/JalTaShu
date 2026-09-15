package com.s15p21b103.good_tashu.cycle.service;

import com.s15p21b103.good_tashu.cycle.domain.*;
import com.s15p21b103.good_tashu.cycle.exception.CycleException;
import com.s15p21b103.good_tashu.cycle.repository.CycleUsageRepository;
import com.s15p21b103.good_tashu.path.domain.PathEntity;
import com.s15p21b103.good_tashu.path.repository.PathRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CycleHistoryQueryTest {
    @Mock CycleUsageRepository usages;
    @Mock PathRepository paths;
    @InjectMocks CycleService service;

    private CycleUsageEntity usage() {
        var start = LocalDateTime.of(2026, 9, 15, 10, 0);
        return CycleUsageEntity.builder().cycleUsageId(12L)
                .cycleEntity(CycleEntity.builder().cycleId("C1").build())
                .rentalAt(start).returnAt(start.plusMinutes(10)).build();
    }

    @Test
    void statisticsMapsRepositoryAggregate() {
        // 저장소에서 집계한 이용 횟수·거리·시간을 통계 응답에 그대로 매핑한다.
        CycleUsageRepository.UsageStatistics statistics = mock(CycleUsageRepository.UsageStatistics.class);
        when(statistics.getTotalUseCnt()).thenReturn(3L);
        when(statistics.getTotalDistance()).thenReturn(12000L);
        when(statistics.getTotalCycleRidingTime()).thenReturn(3600L);
        when(usages.getUsageStatistics(1L)).thenReturn(statistics);

        var result = service.getStatistics(1L);

        assertThat(result.totalUseCnt()).isEqualTo(3L);
        assertThat(result.totalDistance()).isEqualTo(12000L);
        assertThat(result.totalCycleRidingTime()).isEqualTo(3600L);
        verify(usages).getUsageStatistics(1L);
    }

    @Test
    void listMapsStationsAndDuration() {
        // 목록 응답에 대여소 좌표, 이용 시작 시각, 이용 시간을 올바르게 담는다.
        var start = LocalDateTime.of(2026, 9, 15, 10, 0);
        var rentalStation = com.s15p21b103.good_tashu.cycle.domain.StationEntity.builder()
                .stationId("S1").latitude(new java.math.BigDecimal("36.350400"))
                .longitude(new java.math.BigDecimal("127.384500")).build();
        var returnStation = com.s15p21b103.good_tashu.cycle.domain.StationEntity.builder()
                .stationId("S2").latitude(new java.math.BigDecimal("36.351000"))
                .longitude(new java.math.BigDecimal("127.385200")).build();
        var completedUsage = CycleUsageEntity.builder().cycleUsageId(12L)
                .cycleEntity(CycleEntity.builder().cycleId("C1").build())
                .rentalStationEntity(rentalStation).returnStationEntity(returnStation)
                .rentalAt(start).returnAt(start.plusSeconds(600)).build();
        when(usages.findByUserEntity_UserIdAndReturnAtIsNotNullOrderByRentalAtDesc(1L))
                .thenReturn(List.of(completedUsage));

        var result = service.getUsageList(1L).getFirst();

        assertThat(result.usageId()).isEqualTo(12L);
        assertThat(result.cycleId()).isEqualTo("C1");
        assertThat(result.startingPoint().latitude()).isEqualByComparingTo("36.350400");
        assertThat(result.endPoint().longitude()).isEqualByComparingTo("127.385200");
        assertThat(result.startingDate()).isEqualTo(start);
        assertThat(result.totalDuration()).isEqualTo(600);
        verifyNoInteractions(paths);
    }

    @Test
    void listIncludesUsageIdWithoutLoadingPaths() {
        // 목록 조회는 이용내역만 사용하고 경로 저장소를 조회하지 않는지 확인한다.
        when(usages.findByUserEntity_UserIdAndReturnAtIsNotNullOrderByRentalAtDesc(1L))
                .thenReturn(List.of(usage()));
        assertThat(service.getUsageList(1L).getFirst().usageId()).isEqualTo(12L);
        verifyNoInteractions(paths);
    }

    @Test
    void missingPathIsUnknownDistance() {
        // 연결된 경로가 없으면 거리와 평균 속도를 알 수 없음(null)으로 반환한다.
        when(usages.findByCycleUsageIdAndUserEntity_UserId(12L, 1L)).thenReturn(Optional.of(usage()));
        when(paths.findByCycleUsage_CycleUsageId(12L)).thenReturn(Optional.empty());
        var result = service.getUsageDetail(1L, 12L);
        assertThat(result.totalDistance()).isNull();
        assertThat(result.averageCycleRidingSpeed()).isNull();
    }

    @Test
    void speedExcludesWalkingDistance() {
        // 평균 속도는 전체 이동거리가 아니라 자전거 이동거리만으로 계산한다.
        when(usages.findByCycleUsageIdAndUserEntity_UserId(12L, 1L)).thenReturn(Optional.of(usage()));
        when(paths.findByCycleUsage_CycleUsageId(12L)).thenReturn(Optional.of(
                PathEntity.builder().totalDistance(3000).bikeDistance(2000).build()));
        var result = service.getUsageDetail(1L, 12L);
        assertThat(result.totalDistance()).isEqualTo(3000);
        assertThat(result.averageCycleRidingSpeed()).isEqualByComparingTo("12.00");
    }

    @Test
    void missingOrOtherUsersUsageReturnsNotFound() {
        // 다른 사용자의 이용내역을 포함해 존재하지 않는 내역은 404 예외로 처리한다.
        when(usages.findByCycleUsageIdAndUserEntity_UserId(12L, 1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getUsageDetail(1L, 12L))
                .isInstanceOfSatisfying(CycleException.class,
                        e -> assertThat(e.getErrorCode().getStatus().value()).isEqualTo(404));
        verifyNoInteractions(paths);
    }
}
