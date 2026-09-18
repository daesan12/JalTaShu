package com.s15p21b103.good_tashu.claim.controller;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.claim.dto.req.ClaimReportRequest;
import com.s15p21b103.good_tashu.claim.dto.req.CycleClaimRequest;
import com.s15p21b103.good_tashu.claim.dto.req.AbandonedClaimRequest;
import com.s15p21b103.good_tashu.claim.dto.req.EtcClaimRequest;
import com.s15p21b103.good_tashu.claim.dto.res.CycleClaimListResponse;
import com.s15p21b103.good_tashu.claim.dto.res.ClaimResponse;
import com.s15p21b103.good_tashu.claim.service.ClaimService;
import com.s15p21b103.good_tashu.user.annotation.BlockBanUser;
import com.s15p21b103.good_tashu.user.annotation.CurrentUserId;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/claim")
public class ClaimController {

    private final ClaimService claimService;

    // 자전거 고장 제보
    @BlockBanUser
    @PostMapping(value = "/cycle", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ClaimResponse> claimCycle(
            @CurrentUserId Long userId,
            @Valid @ModelAttribute CycleClaimRequest request
    ) {
        ClaimResponse response = claimService.claimCycle(userId, request);
        return ApiResponse.success(response);
    }

    // 자전거 방치 제보
    @BlockBanUser
    @PostMapping(value = "/abandoned", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ClaimResponse> claimCycleAbandoned(
            @CurrentUserId Long userId,
            @Valid @ModelAttribute AbandonedClaimRequest request
    ) {
        ClaimResponse response = claimService.claimAbandoned(userId, request);
        return ApiResponse.success(response);
    }

    // 기타 제보
    @BlockBanUser
    @PostMapping(value = "/etc")
    public ApiResponse<ClaimResponse> claimEtc(
            @CurrentUserId Long userId,
            @Valid @RequestBody EtcClaimRequest request
    ) {
        ClaimResponse response = claimService.claimEtc(userId, request);
        return ApiResponse.success(response);
    }

    //자전거 제보리스트 조회
    @GetMapping("/list")
    public ApiResponse<List<CycleClaimListResponse>> getCycleClaims(
            @RequestParam(name = "cycleId") String cycleId) {
        List<CycleClaimListResponse> response = claimService.getCycleClaims(cycleId);
        return ApiResponse.success(response);
    }

    //자전거 상태제보 신고
    @PostMapping(value = "/claims/{claimId}/reports")
    public ResponseEntity<ApiResponse<Void>> reportCycleClaim(
            @CurrentUserId Long userId,
            @PathVariable(name = "claimId") Long claimId,
            @Valid @RequestBody ClaimReportRequest request) {
        claimService.reportClaim(userId, claimId, request.claimCategory());
        return ResponseEntity.ok(ApiResponse.success("신고가 접수되었습니다."));
    }
}
