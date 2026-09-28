package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu.admin.repository.AdminCycleRepository;
import com.s15p21b103.good_tashu.cycle.repository.StationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminStationNameTest {
    @Mock
    AdminCycleRepository adminCycleRepository;

    @Mock
    StationRepository stationRepository;

    @InjectMocks
    AdminCycleService adminCycleService;

    @Test
    void heatmapIncludesCurrentKoreanStationName() {
        LocalDateTime datetime = LocalDateTime.of(2026, 9, 23, 8, 0);
        AdminCycleRepository.HeatmapRow row = mock(AdminCycleRepository.HeatmapRow.class);
        when(row.getStationId()).thenReturn("ST0012");
        when(row.getStationName()).thenReturn("둔산동 시청역 8번출구");
        when(row.getXPos()).thenReturn(new BigDecimal("127.386942"));
        when(row.getYPos()).thenReturn(new BigDecimal("36.350583"));
        when(row.getRentCnt()).thenReturn(12L);
        when(row.getReturnCnt()).thenReturn(7L);
        when(adminCycleRepository.findHeatmap(datetime.minusHours(1), datetime))
                .thenReturn(List.of(row));

        var response = adminCycleService.getHeatmap(datetime).getFirst();

        assertThat(response.stationId()).isEqualTo("ST0012");
        assertThat(response.stationName()).isEqualTo("둔산동 시청역 8번출구");
    }

    @Test
    void stationDetailIncludesCurrentKoreanStationName() {
        AdminCycleRepository.StationDetailStats stats =
                mock(AdminCycleRepository.StationDetailStats.class);
        when(stationRepository.existsById("ST0012")).thenReturn(true);
        when(stats.getStationName()).thenReturn("둔산동 시청역 8번출구");
        when(stats.getCurrentBikeCnt()).thenReturn(4L);
        when(stats.getTodayRentalCnt()).thenReturn(10L);
        when(stats.getTodayReturnCnt()).thenReturn(8L);
        when(stats.getCurrentReportCnt()).thenReturn(1L);
        when(stats.getYesterdayBikeCnt()).thenReturn(3L);
        when(stats.getYesterdayRentalCnt()).thenReturn(9L);
        when(stats.getYesterdayReturnCnt()).thenReturn(7L);
        when(stats.getYesterdayReportCnt()).thenReturn(0L);
        when(adminCycleRepository.findStationDetailStats(eq("ST0012"), any(), any(), any(), any(), any()))
                .thenReturn(stats);

        var response = adminCycleService.getStationDetail("ST0012");

        assertThat(response.stationName()).isEqualTo("둔산동 시청역 8번출구");
    }
}
