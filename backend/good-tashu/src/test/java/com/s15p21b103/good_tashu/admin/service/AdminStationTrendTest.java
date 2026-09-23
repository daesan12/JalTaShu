package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu.admin.dto.res.AdminStationTrendResponse;
import com.s15p21b103.good_tashu.admin.exception.AdminException;
import com.s15p21b103.good_tashu.admin.repository.AdminCycleRepository;
import com.s15p21b103.good_tashu.cycle.repository.StationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.INVALID_STATION_ID;
import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.NOT_EXISTS_STATION;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminStationTrendTest {

    @Mock
    AdminCycleRepository adminCycleRepository;

    @Mock
    StationRepository stationRepository;

    @InjectMocks
    AdminCycleService adminCycleService;

    @Test
    void returnsOnlyRequestedStationTrendAndFillsDatesWithoutEvents() {
        // 서비스가 서울 기준 날짜를 쓰므로 테스트도 맞춘다 — CI 컨테이너는 UTC라 0~9시(KST)에 날짜가 갈린다
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        LocalDate eventDate = today.minusDays(3);
        AdminCycleRepository.StationTrendRow row = mock(AdminCycleRepository.StationTrendRow.class);
        when(row.getDate()).thenReturn(eventDate.toString());
        when(row.getRentalCnt()).thenReturn(4L);
        when(row.getReturnCnt()).thenReturn(2L);
        when(stationRepository.existsById("ST001")).thenReturn(true);
        when(adminCycleRepository.findStationTrend(
                eq("ST001"), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(row));

        List<AdminStationTrendResponse> result = adminCycleService.getStationTrend("ST001", "week");

        assertThat(result).hasSize(7);
        assertThat(result).extracting(AdminStationTrendResponse::date)
                .containsExactly(
                        today.minusDays(7), today.minusDays(6), today.minusDays(5),
                        today.minusDays(4), today.minusDays(3), today.minusDays(2),
                        today.minusDays(1));
        assertThat(result).filteredOn(point -> point.date().equals(eventDate))
                .singleElement()
                .extracting(AdminStationTrendResponse::rentalCnt, AdminStationTrendResponse::returnCnt)
                .containsExactly(4L, 2L);
        assertThat(result).filteredOn(point -> !point.date().equals(eventDate))
                .allSatisfy(point -> {
                    assertThat(point.rentalCnt()).isZero();
                    assertThat(point.returnCnt()).isZero();
                });
        verify(adminCycleRepository).findStationTrend(
                "ST001", today.minusDays(7).atStartOfDay(), today.atStartOfDay());
    }

    @Test
    void rejectsBlankStationIdBeforeRepositoryLookup() {
        assertThatThrownBy(() -> adminCycleService.getStationTrend(" ", "week"))
                .isInstanceOfSatisfying(AdminException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(INVALID_STATION_ID));

        verifyNoInteractions(stationRepository, adminCycleRepository);
    }

    @Test
    void rejectsUnknownStation() {
        when(stationRepository.existsById("UNKNOWN")).thenReturn(false);

        assertThatThrownBy(() -> adminCycleService.getStationTrend("UNKNOWN", "week"))
                .isInstanceOfSatisfying(AdminException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXISTS_STATION));

        verifyNoInteractions(adminCycleRepository);
    }
}
