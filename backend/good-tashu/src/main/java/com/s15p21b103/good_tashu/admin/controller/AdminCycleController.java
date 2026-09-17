package com.s15p21b103.good_tashu.admin.controller;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.admin.annotation.currentAdminId;
import com.s15p21b103.good_tashu.admin.dto.req.AdminCycleClaimUpdateRequest;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleClaimResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleClaimDetailResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleClaimListResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleClaimUpdateResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleStatisticsResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleListResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleDetailStatisticsResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleHistoryResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminHeatmapResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminStationDetailResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminStationTrendResponse;
import com.s15p21b103.good_tashu.admin.service.AdminCycleService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import org.springframework.format.annotation.DateTimeFormat;
import java.util.List;


@RequiredArgsConstructor
@RestController
@RequestMapping("/api/admin")
public class AdminCycleController {
    private final AdminCycleService adminCycleService;

    // 자전거별 제보 조회
    @GetMapping("/cycle/{cycleId}/claim")
    public ApiResponse<List<AdminCycleClaimResponse>> getCycleClaims(
            @currentAdminId Long adminId,
            @PathVariable(name = "cycleId") String cycleId) {
        return ApiResponse.success(adminCycleService.getCycleClaims(cycleId));
    }

    // 자전거 신고 상세 조회
    @GetMapping("/cycle/claim/{claimId}")
    public ApiResponse<AdminCycleClaimDetailResponse> getCycleClaimDetail(
            @currentAdminId Long adminId,
            @PathVariable(name = "claimId") Long claimId) {
        return ApiResponse.success(adminCycleService.getCycleClaimDetail(claimId));
    }

    // 모든 자전거 제보 조회
    @GetMapping("/cycle/claim")
    public ApiResponse<List<AdminCycleClaimListResponse>> getCycleClaimList(
            @currentAdminId Long adminId,
            @RequestParam(name = "nickname", defaultValue = "") String nickname,
            @RequestParam(name = "cycleId", defaultValue = "") String cycleId,
            @RequestParam(name = "order", defaultValue = "newest") String order,
            @RequestParam(name = "status", defaultValue = "") String status) {
        return ApiResponse.success(
                adminCycleService.getCycleClaimList(nickname, cycleId, order, status));
    }

    // 제보 상태 변경 및 관리자 코멘트 작성
    @PatchMapping("/cycle/claim/{claimId}")
    public ApiResponse<AdminCycleClaimUpdateResponse> updateCycleClaim(
            @currentAdminId Long adminId,
            @PathVariable(name = "claimId") Long claimId,
            @Valid @RequestBody AdminCycleClaimUpdateRequest request) {
        return ApiResponse.success(adminCycleService.updateCycleClaim(claimId, request));
    }

    // 모든 자전거 통계
    @GetMapping("/cycle/statics")
    public ApiResponse<AdminCycleStatisticsResponse> getCycleStatistics(
            @currentAdminId Long adminId) {
        return ApiResponse.success(adminCycleService.getCycleStatistics());
    }

    // 자전거 목록 확인
    @GetMapping("/cycle/list")
    public ApiResponse<List<AdminCycleListResponse>> getCycleList(
            @currentAdminId Long adminId,
            @RequestParam(name = "cycle", defaultValue = "") String cycle,
            @RequestParam(name = "stationName", defaultValue = "") String stationName,
            @RequestParam(name = "statement", defaultValue = "") String statement,
            @RequestParam(name = "hasClaim", required = false) Boolean hasClaim) {
        return ApiResponse.success(adminCycleService.getCycleList(cycle, stationName, statement, hasClaim));
    }

    // 자전거 개별 통계
    @GetMapping("/cycle/{cycleId}/statics")
    public ApiResponse<AdminCycleDetailStatisticsResponse> getCycleDetailStatistics(
            @currentAdminId Long adminId,
            @PathVariable(name = "cycleId") String cycleId) {
        return ApiResponse.success(adminCycleService.getCycleDetailStatistics(cycleId));
    }

    // 자전거 이용 이력 조회
    @GetMapping("/cycle/{cycleId}")
    public ApiResponse<List<AdminCycleHistoryResponse>> getCycleHistory(
            @currentAdminId Long adminId,
            @PathVariable(name = "cycleId") String cycleId) {
        return ApiResponse.success(adminCycleService.getCycleHistory(cycleId));
    }

    //히트맵 조회
    @GetMapping("/heatmap")
    public ApiResponse<List<AdminHeatmapResponse>> getRentalHeatmap(
            @currentAdminId Long adminId,
            @RequestParam(name = "datetime")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime datetime) {
        return ApiResponse.success(adminCycleService.getHeatmap(datetime));
    }

    //대여소 상세조회
    @GetMapping("/station/{stationId}")
    public ApiResponse<AdminStationDetailResponse> getStationDetail(
            @currentAdminId Long adminId,
            @PathVariable String stationId) {
        return ApiResponse.success(adminCycleService.getStationDetail(stationId));
    }

    // 대여소 날짜별 대여·반납 추이
    @GetMapping("/station/trend")
    public ApiResponse<List<AdminStationTrendResponse>> getStationTrend(
            @currentAdminId Long adminId,
            @RequestParam(name = "term") String term) {
        // 오늘은 제외하고 term 범위의 날짜별 대여·반납 건수를 리스트로 반환
        // day는 하루, week는 7일 범위로 조회
        return ApiResponse.success(adminCycleService.getStationTrend(term));
    }
}
