package com.s15p21b103.good_tashu.cycle.controller;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleClaimRequest;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleClaimReportRequest;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleRentalRequest;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleReturnRequest;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleClaimResponse;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleClaimListResponse;
import com.s15p21b103.good_tashu.cycle.service.CycleService;
import com.s15p21b103.good_tashu.user.annotation.BlockBanUser;
import com.s15p21b103.good_tashu.user.annotation.CurrentUserId;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleStatisticsResponse;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleUsageListResponse;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleUsageDetailResponse;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/cycle")
public class CycleController {
    private final CycleService cycleService;

    //대여 요청
    @PostMapping("/rental")
    public ApiResponse<LocalDateTime> rentalCycle(@CurrentUserId Long userId,
                                                  @Valid @RequestBody CycleRentalRequest request){
        LocalDateTime localDateTime = cycleService.rentalCycle(userId, request);
        return ApiResponse.success(localDateTime);
    }
    //반납 요청
    @PostMapping("return")
    public ApiResponse<LocalDateTime> returnCycle(@CurrentUserId Long userId,
                                                  @Valid @RequestBody CycleReturnRequest request){
        LocalDateTime localDateTime = cycleService.returnCycle(userId, request);
        return ApiResponse.success(localDateTime);
    }
    //자전거 상태제보
    @BlockBanUser
    @PostMapping(value = "/claim", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<CycleClaimResponse> claimCycle(@CurrentUserId Long userId,
                                                  @Valid @ModelAttribute CycleClaimRequest request){
        CycleClaimResponse response = cycleService.claimCycle(userId, request);
        return ApiResponse.success(response);
    }
    //자전거 제보리스트 조회
    @GetMapping("/list")
    public ApiResponse<List<CycleClaimListResponse>> getCycleClaims(
            @RequestParam(name = "cycleId") String cycleId) {
        List<CycleClaimListResponse> response = cycleService.getCycleClaims(cycleId);
        return ApiResponse.success(response);
    }

    //자전거 상태제보 신고
    @PostMapping(value = "/claims/{claimId}/reports")
    public ResponseEntity<ApiResponse<Void>> reportCycleClaim(
            @CurrentUserId Long userId,
            @PathVariable(name = "claimId") Long claimId,
            @Valid @RequestBody CycleClaimReportRequest request) {
        cycleService.reportCycleClaim(userId, claimId, request.claimCategory());
        return ResponseEntity.ok(ApiResponse.success("신고가 접수되었습니다."));
    }

    //개인이용내역 전체 통계 조회
    @GetMapping("/statics")
    public ApiResponse<CycleStatisticsResponse> getStatistics(@CurrentUserId Long userId) {
        return ApiResponse.success(cycleService.getStatistics(userId));
    }

    //개인이용내역 리스트 조회
    @GetMapping("/usage/list")
    public ApiResponse<List<CycleUsageListResponse>> getUsageList(@CurrentUserId Long userId) {
        return ApiResponse.success(cycleService.getUsageList(userId));
    }

    //개인이용내역 상세 조회
    @GetMapping("/usage/{usageId}")
    public ApiResponse<CycleUsageDetailResponse> getUsageDetail(@CurrentUserId Long userId,
                                                                 @PathVariable Long usageId) {
        return ApiResponse.success(cycleService.getUsageDetail(userId, usageId));
    }
}
