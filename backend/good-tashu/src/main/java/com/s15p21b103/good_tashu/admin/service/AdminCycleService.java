package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu._util.service.S3Service;
import com.s15p21b103.good_tashu.admin.dto.req.AdminCycleClaimUpdateRequest;
import com.s15p21b103.good_tashu.admin.dto.res.AdminHeatmapResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleClaimResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleClaimListResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleClaimDetailResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleClaimReportResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleClaimUpdateResponse;
import com.s15p21b103.good_tashu.cycle.domain.CycleClaimEntity;
import com.s15p21b103.good_tashu.cycle.domain.ClaimStatus;
import com.s15p21b103.good_tashu.cycle.domain.CycleUsageEntity;
import com.s15p21b103.good_tashu.cycle.repository.CycleClaimRepository;
import com.s15p21b103.good_tashu.cycle.repository.CycleClaimReportRepository;
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
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.*;

@Service
@RequiredArgsConstructor
public class AdminCycleService {
    private final AdminCycleRepository adminCycleRepository;
    private final StationRepository stationRepository;
    private final CycleClaimRepository cycleClaimRepository;
    private final CycleClaimReportRepository cycleClaimReportRepository;
    private final S3Service s3Service;

    @Transactional
    public AdminCycleClaimUpdateResponse updateCycleClaim(
            Long claimId, AdminCycleClaimUpdateRequest request) {
        // 대상과 필수 상태를 검증한 뒤 영속 엔티티의 상태·코멘트를 변경한다.
        if (claimId == null || claimId <= 0) {
            throw new AdminException(INVALID_CLAIM_ID);
        }
        if (request == null || request.statement() == null) {
            throw new AdminException(INVALID_CLAIM_STATUS);
        }

        CycleClaimEntity claim = cycleClaimRepository.findById(claimId)
                .orElseThrow(() -> new AdminException(NOT_EXISTS_CLAIM));
        claim.updateReview(request.statement(), request.content());
        return new AdminCycleClaimUpdateResponse(claim.getId());
    }

    @Transactional(readOnly = true)
    public List<AdminCycleClaimListResponse> getCycleClaimList(
            String nickname, String cycleId, String order, String status) {
        String nicknameFilter = normalizeSearchText(nickname);
        String cycleIdFilter = normalizeSearchText(cycleId);
        String orderFilter = normalizeSearchText(order).toLowerCase(Locale.ROOT);

        if (!orderFilter.equals("newest") && !orderFilter.equals("oldest")) {
            throw new AdminException(INVALID_ORDER);
        }

        ClaimStatus statusFilter = null;
        String normalizedStatus = normalizeSearchText(status).toUpperCase(Locale.ROOT);
        if (!normalizedStatus.isEmpty()) {
            try {
                statusFilter = ClaimStatus.valueOf(normalizedStatus);
            } catch (IllegalArgumentException exception) {
                throw new AdminException(INVALID_CLAIM_STATUS);
            }
        }

        // 생성일이 같을 때도 ID로 순서를 고정한다.
        Sort.Direction direction = Sort.Direction.DESC;
        if (orderFilter.equals("oldest")) {
            direction = Sort.Direction.ASC;
        }
        Sort sort = Sort.by(direction, "createdAt").and(Sort.by(direction, "id"));

        // 검색 조건을 DB에 적용하고 요청한 생성일 순서로 조회한다.
        return cycleClaimRepository
                .findAllForAdmin(nicknameFilter, cycleIdFilter, statusFilter, sort)
                .stream()
                .map(claim -> {
                    CycleUsageEntity usage = claim.getCycleUsageEntity();
                    // 제보 신고 건수와 관리자 코멘트 존재 여부를 목록에 함께 표시한다.
                    long reportCount = cycleClaimReportRepository
                            .countByCycleClaimEntity_Id(claim.getId());
                    String comment = claim.getAdminComment();
                    boolean hasComment = comment != null && !comment.isBlank();

                    return new AdminCycleClaimListResponse(
                            claim.getId(),
                            usage.getCycleEntity().getCycleId(),
                            usage.getCycleUsageId(),
                            claim.getContent(),
                            claim.getClaimCategory(),
                            usage.getUserEntity().getNickname(),
                            usage.getUserEntity().getUserId(),
                            claim.getCreatedAt(),
                            reportCount,
                            claim.getStatus(),
                            hasComment);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public AdminCycleClaimDetailResponse getCycleClaimDetail(Long claimId) {
        if (claimId == null || claimId <= 0) {
            throw new AdminException(INVALID_CLAIM_ID);
        }

        // 제보와 작성자, 자전거 정보를 함께 조회한다.
        CycleClaimEntity claim = cycleClaimRepository.findById(claimId)
                .orElseThrow(() -> new AdminException(NOT_EXISTS_CLAIM));
        // 제보가 참조하는 실제 이용 기록에서 자전거·작성자·대여 시간을 가져온다.
        CycleUsageEntity usage = claim.getCycleUsageEntity();
        String cycleId = usage.getCycleEntity().getCycleId();
        Long userId = usage.getUserEntity().getUserId();
        String nickname = usage.getUserEntity().getNickname();

        String photoUrl = null;
        if (claim.getPath() != null && !claim.getPath().isBlank()) {
            photoUrl = s3Service.createDownloadUrl(claim.getPath());
        }

        // 해당 제보를 신고한 사용자 목록을 최신순으로 반환한다.
        List<AdminCycleClaimReportResponse> reports = cycleClaimReportRepository
                .findAllByCycleClaimEntity_IdOrderByCreatedAtDescIdDesc(claimId)
                .stream()
                .map(report -> new AdminCycleClaimReportResponse(
                        report.getId(),
                        report.getClaimCategory(),
                        report.getCreatedAt(),
                        report.getUserEntity().getUserId(),
                        report.getUserEntity().getNickname()))
                .toList();

        return new AdminCycleClaimDetailResponse(
                claim.getId(), cycleId, userId, nickname, claim.getCreatedAt(),
                usage.getCycleUsageId(), usage.getRentalAt(), usage.getReturnAt(),
                claim.getContent(), claim.getStatus(),
                claim.getAdminComment(), photoUrl, reports);
    }

    @Transactional(readOnly = true)
    public List<AdminCycleClaimResponse> getCycleClaims(String cycleId) {
        // 자전거 ID와 존재 여부를 확인한다.
        if (cycleId == null || cycleId.isBlank()) {
            throw new AdminException(INVALID_CYCLE_ID);
        }
        if (!adminCycleRepository.existsById(cycleId)) {
            throw new AdminException(NOT_EXISTS_CYCLE);
        }
        // 처리 상태와 관계없이 최신 제보부터 반환한다.
        return cycleClaimRepository
                .findAllByCycleUsageEntity_CycleEntity_CycleIdOrderByCreatedAtDescIdDesc(cycleId)
                .stream()
                .map(claim -> {
                    CycleUsageEntity usage = claim.getCycleUsageEntity();
                    String nickname = null;
                    if (usage.getUserEntity() != null) {
                        nickname = usage.getUserEntity().getNickname();
                    }
                    // null 또는 공백 코멘트는 작성되지 않은 것으로 처리한다.
                    String comment = claim.getAdminComment();
                    boolean hasComment = comment != null && !comment.isBlank();
                    String claimCycleId = null;
                    if (usage.getCycleEntity() != null) {
                        claimCycleId = usage.getCycleEntity().getCycleId();
                    }
                    Long userId = null;
                    if (usage.getUserEntity() != null) {
                        userId = usage.getUserEntity().getUserId();
                    }
                    long cycleReportNum = cycleClaimReportRepository.countByCycleClaimEntity_Id(claim.getId());
                    return new AdminCycleClaimResponse(
                            claim.getId(), claimCycleId, claim.getContent(), claim.getClaimCategory(),
                            nickname, userId, claim.getCreatedAt(), cycleReportNum,
                            claim.getStatus(), hasComment);
                })
                .toList();
    }

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
                        datetime, row.getStationId(),
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
        StationDetailStats stats = adminCycleRepository.findStationDetailStats(stationId);
        return new AdminStationDetailResponse(
                stats.getCurrentBikeCnt(), stats.getTodayRentalCnt(), stats.getTodayReturnCnt(),
                stats.getCurrentReportCnt(), stats.getYesterdayBikeCnt(), stats.getYesterdayRentalCnt(),
                stats.getYesterdayReturnCnt(), stats.getYesterdayReportCnt());
    }

    @Transactional(readOnly = true)
    public List<AdminStationTrendResponse> getStationTrend(String term) {
        String normalizedTerm = normalizeTerm(term);
        // 오늘을 제외한 기간별 날짜 집계 결과를 응답 DTO로 변환한다.
        return adminCycleRepository.findStationTrend(normalizedTerm).stream()
                .map(row -> new AdminStationTrendResponse(
                        LocalDate.parse(row.getDate()), row.getRentalCnt(), row.getReturnCnt()))
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
