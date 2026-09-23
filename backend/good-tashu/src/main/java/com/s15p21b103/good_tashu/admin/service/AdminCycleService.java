package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu.admin.dto.res.AdminHeatmapResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleHistoryResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleDetailStatisticsResponse;
import com.s15p21b103.good_tashu.admin.repository.AdminCycleRepository.CycleDetailStatistics;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleListResponse;
import com.s15p21b103.good_tashu.cycle.domain.CycleStatus;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleStatisticsResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminStationDetailResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminStationTrendResponse;
import com.s15p21b103.good_tashu.admin.exception.AdminException;
import com.s15p21b103.good_tashu.admin.repository.AdminCycleRepository;
import com.s15p21b103.good_tashu.admin.repository.AdminCycleRepository.CycleStatistics;
import com.s15p21b103.good_tashu.admin.repository.AdminCycleRepository.StationDetailStats;
import com.s15p21b103.good_tashu.cycle.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.*;

@Service
@RequiredArgsConstructor
public class AdminCycleService {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private final AdminCycleRepository adminCycleRepository;
    private final StationRepository stationRepository;
    @Transactional(readOnly = true)
    public List<AdminCycleHistoryResponse> getCycleHistory(String cycleId) {
        // 존재하지 않는 자전거와 이용내역이 없는 자전거를 구분한다.
        if (cycleId == null || cycleId.isBlank()) {
            throw new AdminException(INVALID_CYCLE_ID);
        }
        if (!adminCycleRepository.existsById(cycleId)) {
            throw new AdminException(NOT_EXISTS_CYCLE);
        }
        // 진행 중인 대여를 포함한 이용 이력을 최신 대여 순으로 반환한다.
        return adminCycleRepository.findCycleHistory(cycleId).stream()
                .map(row -> new AdminCycleHistoryResponse(
                        row.getRecordId(), row.getUsingAt(), row.getStartingPoint(),
                        row.getEndPoint(), row.getUserId(), row.getNickname()))
                .toList();
    }

    @Transactional(readOnly = true)
    public AdminCycleDetailStatisticsResponse getCycleDetailStatistics(String cycleId) {
        if (cycleId == null || cycleId.isBlank()) {
            throw new AdminException(INVALID_CYCLE_ID);
        }
        // 자전거 존재 여부와 개별 통계를 한 번의 조회로 확인한다.
        CycleDetailStatistics statistics = adminCycleRepository.findCycleDetailStatistics(cycleId)
                .orElseThrow(() -> new AdminException(NOT_EXISTS_CYCLE));
        // 이용 횟수는 진행 중인 대여를 포함하며, 제보는 미처리 건만 집계한다.
        return new AdminCycleDetailStatisticsResponse(
                statistics.getUsingCnt(), statistics.getRecentUsingAt(),
                statistics.getUnresolvedClaim(), statistics.getRegisteredAt());
    }

    @Transactional(readOnly = true)
    public List<AdminCycleListResponse> getCycleList(
            String cycle, String stationName, String statement, Boolean hasClaim) {
        // 빈 검색 조건은 전체 조회로 처리하고 상태 값을 검증한다.
        String cycleFilter = normalizeSearchText(cycle);
        String stationFilter = normalizeSearchText(stationName);
        String statusFilter = normalizeSearchText(statement).toUpperCase(Locale.ROOT);
        if (!statusFilter.isEmpty()) {
            try {
                CycleStatus.valueOf(statusFilter);
            } catch (IllegalArgumentException e) {
                throw new AdminException(INVALID_CYCLE_STATEMENT);
            }
        }
        // DB에서 필터링한 결과를 목록 응답으로 변환한다.
        return adminCycleRepository.findCycleList(cycleFilter, stationFilter, statusFilter, hasClaim)
                .stream()
                .map(row -> new AdminCycleListResponse(
                        row.getCycleId(), row.getCurrentLocation(), CycleStatus.valueOf(row.getStatement()),
                        row.getRecentUsingAt(), row.getClaimCnt()))
                .toList();
    }

    private String normalizeSearchText(String value) {
        if (value == null) {
            return "";
        }
        return value.strip();
    }

    @Transactional(readOnly = true)
    public AdminCycleStatisticsResponse getCycleStatistics() {
        // 전체·대여 중·대기 중·미처리 제보가 있는 자전거 수를 조회한다.
        CycleStatistics statistics = adminCycleRepository.findCycleStatistics();
        return new AdminCycleStatisticsResponse(
                statistics.getTotalCycleCnt(), statistics.getRentCycleCnt(),
                statistics.getWaitCycleCnt(), statistics.getClaimCycleCnt());
    }

    @Transactional(readOnly = true)
    public List<AdminHeatmapResponse> getHeatmap(LocalDateTime datetime) {
        if (datetime == null) {
            throw new AdminException(INVALID_DATE);
        }
        // 직전 1시간을 대여소별로 집계하고 time에는 조회 기준 시각을 담는다.
        return adminCycleRepository.findHeatmap(datetime.minusHours(1), datetime).stream()
                .map(row -> new AdminHeatmapResponse(
                        datetime, row.getStationId(), row.getStationName(),
                        row.getXPos(), row.getYPos(), row.getRentCnt(), row.getReturnCnt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public AdminStationDetailResponse getStationDetail(String stationId) {
        if (stationId == null || stationId.isBlank()) {
            throw new AdminException(INVALID_STATION_ID);
        }
        if (!stationRepository.existsById(stationId)) {
            throw new AdminException(NOT_EXISTS_STATION);
        }
        // 현재 수량과 오늘·24시간 전 기준 통계를 응답 DTO로 변환한다.
        // "오늘"·"24시간 전"은 KST로 계산해 넘긴다 — DB 시계(UTC)를 쓰면 9시간 어긋난다.
        LocalDateTime now = LocalDateTime.now(SEOUL);
        LocalDateTime todayStart = now.toLocalDate().atStartOfDay();
        StationDetailStats stats = adminCycleRepository.findStationDetailStats(stationId,
                todayStart, todayStart.plusDays(1), todayStart.minusDays(1),
                now.minusHours(24), now.minusHours(48));
        return new AdminStationDetailResponse(
                stats.getStationName(), stats.getCurrentBikeCnt(),
                stats.getTodayRentalCnt(), stats.getTodayReturnCnt(),
                stats.getCurrentReportCnt(), stats.getYesterdayBikeCnt(), stats.getYesterdayRentalCnt(),
                stats.getYesterdayReturnCnt(), stats.getYesterdayReportCnt());
    }

    @Transactional(readOnly = true)
    public List<AdminStationTrendResponse> getStationTrend(String stationId, String term) {
        if (stationId == null || stationId.isBlank()) {
            throw new AdminException(INVALID_STATION_ID);
        }
        if (!stationRepository.existsById(stationId)) {
            throw new AdminException(NOT_EXISTS_STATION);
        }
        String normalizedTerm = normalizeTerm(term);
        int days = normalizedTerm.equals("day") ? 1 : 7;
        LocalDate today = LocalDate.now(SEOUL);
        LocalDate fromDate = today.minusDays(days);

        Map<LocalDate, AdminStationTrendResponse> trendByDate = adminCycleRepository.findStationTrend(
                        stationId, fromDate.atStartOfDay(), today.atStartOfDay()).stream()
                .map(row -> new AdminStationTrendResponse(
                        LocalDate.parse(row.getDate()), row.getRentalCnt(), row.getReturnCnt()))
                .collect(Collectors.toMap(AdminStationTrendResponse::date, Function.identity()));

        return IntStream.range(0, days)
                .mapToObj(index -> fromDate.plusDays(index))
                .map(date -> trendByDate.getOrDefault(
                        date, new AdminStationTrendResponse(date, 0L, 0L)))
                .toList();
    }

    private String normalizeTerm(String term) {
        if (term == null || term.isBlank()) {
            throw new AdminException(INVALID_TERM);
        }
        String normalized = term.strip().toLowerCase(Locale.ROOT);
        if (!normalized.equals("day") && !normalized.equals("week")) {
            throw new AdminException(INVALID_TERM);
        }
        return normalized;
    }
}
