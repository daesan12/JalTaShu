package com.s15p21b103.good_tashu.cycle.controller;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.cycle.dto.req.*;
import com.s15p21b103.good_tashu.cycle.service.CycleService;
import com.s15p21b103.good_tashu.user.annotation.CurrentUserId;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleStatisticsResponse;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleUsageListResponse;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleUsageDetailResponse;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleStatementResponse;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/cycle")
public class CycleController {
    private final CycleService cycleService;

    @GetMapping("/statement/{cycleId}")
    public ApiResponse<CycleStatementResponse> getCycleStatement(
            @PathVariable(name = "cycleId") String cycleId) {
        return ApiResponse.success(cycleService.getCycleStatement(cycleId));
    }

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

    // 경로 기록 저장
    @PostMapping("/usage")
    public ResponseEntity<ApiResponse<Void>> savePathTrace(
            @CurrentUserId Long userId,
            @Valid @RequestBody CyclePathRequest request
            ) {
        cycleService.savePathTrace(userId, request);
        return ResponseEntity.ok(ApiResponse.success("성공"));
    }
}
