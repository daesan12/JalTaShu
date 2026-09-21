package com.s15p21b103.good_tashu.admin.controller;


import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.admin.annotation.CurrentAdminId;
import com.s15p21b103.good_tashu.admin.dto.req.AdminClaimUpdateRequest;
import com.s15p21b103.good_tashu.admin.dto.res.AdminClaimDetailResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminClaimResponse;
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
    @GetMapping("/{claimId}")
    public ApiResponse<AdminClaimDetailResponse> getClaimDetail(
            @CurrentAdminId Long adminId,
            @PathVariable(name = "claimId") Long claimId) {
        return ApiResponse.success(adminClaimService.getClaimDetail(claimId));
    }

    // 제보 상태 변경 및 관리자 코멘트 작성
    @PatchMapping("/{claimId}")
    public ApiResponse<AdminClaimUpdateResponse> updateClaim(
            @CurrentAdminId Long adminId,
            @PathVariable(name = "claimId") Long claimId,
            @Valid @RequestBody AdminClaimUpdateRequest request) {
        return ApiResponse.success(adminClaimService.updateCycleClaim(claimId, request));
    }

    // 특정 자전거에 대한 제보 조회
    @GetMapping("/cycle/{cycleId}")
    public ApiResponse<List<AdminClaimResponse>> getCycleClaimList(
            @CurrentAdminId Long adminId,
            @PathVariable(name = "cycleId") String cycleId
    ) {
        return ApiResponse.success(adminClaimService.getCycleClaims(cycleId));
    }

    // 모든 자전거 제보 조회
    @GetMapping("/list")
    public ApiResponse<List<AdminClaimResponse>> getClaimList(
            @CurrentAdminId Long adminId,
            @RequestParam(name = "nickname", defaultValue = "") String nickname,
            @RequestParam(name = "cycleId", defaultValue = "") String cycleId,
            @RequestParam(name = "order", defaultValue = "newest") String order,
            @RequestParam(name = "status", defaultValue = "") String status) {
        return ApiResponse.success(
                adminClaimService.getClaimList(nickname, cycleId, order, status));
    }


}
