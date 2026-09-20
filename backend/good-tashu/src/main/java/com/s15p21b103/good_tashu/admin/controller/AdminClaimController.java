package com.s15p21b103.good_tashu.admin.controller;


import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.admin.annotation.CurrentAdminId;
import com.s15p21b103.good_tashu.admin.dto.req.AdminClaimUpdateRequest;
import com.s15p21b103.good_tashu.admin.dto.res.AdminClaimDetailResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminClaimListResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminClaimUpdateResponse;
import com.s15p21b103.good_tashu.admin.service.AdminClaimService;
import com.s15p21b103.good_tashu.admin.service.AdminCycleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/admin/claim")
public class AdminClaimController {
    private final AdminCycleService adminCycleService;
    private final AdminClaimService adminClaimService;

    // 신고 상세 조회
    @GetMapping("/claim/{claimId}")
    public ApiResponse<AdminClaimDetailResponse> getCycleClaimDetail(
            @CurrentAdminId Long adminId,
            @PathVariable(name = "claimId") Long claimId) {
        return ApiResponse.success(adminClaimService.getCycleClaimDetail(claimId));
    }

    // 모든 자전거 제보 조회
    @GetMapping("/list")
    public ApiResponse<List<AdminClaimListResponse>> getCycleClaimList(
            @CurrentAdminId Long adminId,
            @RequestParam(name = "nickname", defaultValue = "") String nickname,
            @RequestParam(name = "cycleId", defaultValue = "") String cycleId,
            @RequestParam(name = "order", defaultValue = "newest") String order,
            @RequestParam(name = "status", defaultValue = "") String status) {
        return ApiResponse.success(
                adminClaimService.getCycleClaimList(nickname, cycleId, order, status));
    }

    // 제보 상태 변경 및 관리자 코멘트 작성
    @PatchMapping("/claim/{claimId}")
    public ApiResponse<AdminClaimUpdateResponse> updateCycleClaim(
            @CurrentAdminId Long adminId,
            @PathVariable(name = "claimId") Long claimId,
            @Valid @RequestBody AdminClaimUpdateRequest request) {
        return ApiResponse.success(adminClaimService.updateCycleClaim(claimId, request));
    }
}
