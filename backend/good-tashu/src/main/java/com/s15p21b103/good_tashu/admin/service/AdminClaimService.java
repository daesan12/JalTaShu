package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu._util.service.S3Service;
import com.s15p21b103.good_tashu.admin.dto.req.AdminClaimUpdateRequest;
import com.s15p21b103.good_tashu.admin.dto.res.*;
import com.s15p21b103.good_tashu.admin.exception.AdminException;
import com.s15p21b103.good_tashu.admin.repository.AdminCycleRepository;
import com.s15p21b103.good_tashu.claim.domain.ClaimEntity;
import com.s15p21b103.good_tashu.claim.domain.ClaimStatus;
import com.s15p21b103.good_tashu.claim.repository.ClaimReportRepository;
import com.s15p21b103.good_tashu.claim.repository.ClaimRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.*;
import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.NOT_EXISTS_CLAIM;

@Service
@RequiredArgsConstructor
public class AdminClaimService {
    private final AdminCycleRepository adminCycleRepository;
    private final ClaimRepository claimRepository;
    private final ClaimReportRepository claimReportRepository;
    private final S3Service s3Service;

    @Transactional(readOnly = true)
    public List<AdminClaimResponse> getCycleClaims(String cycleId) {
        // 자전거 ID와 존재 여부를 확인한다.
        if (cycleId == null || cycleId.isBlank()) {
            throw new AdminException(INVALID_CYCLE_ID);
        }
        if (!adminCycleRepository.existsById(cycleId)) {
            throw new AdminException(NOT_EXISTS_CYCLE);
        }
        // 처리 상태와 관계없이 최신 제보부터 반환한다.
        return claimRepository
                .findAllByCycleEntity_CycleIdOrderByCreatedAtDescClaimIdDesc(cycleId)
                .stream()
                .map(claim -> {
                    String nickname = null;
                    if (claim.getUserEntity() != null) {
                        nickname = claim.getUserEntity().getNickname();
                    }
                    // null 또는 공백 코멘트는 작성되지 않은 것으로 처리한다.
                    String comment = claim.getAdminComment();
                    boolean hasComment = comment != null && !comment.isBlank();
                    String claimCycleId = null;
                    if (claim.getCycleEntity() != null) {
                        claimCycleId = claim.getCycleEntity().getCycleId();
                    }
                    Long userId = null;
                    if (claim.getUserEntity() != null) {
                        userId = claim.getUserEntity().getUserId();
                    }
                    long cycleReportNum = claimReportRepository.countByClaimEntity_ClaimId(claim.getClaimId());
                    return new AdminClaimResponse(
                            claim.getClaimId(),
                            claim.getClaimType(),
                            userId,
                            nickname,
                            claimCycleId,
                            claim.getClaimCategory(),
                            claim.getContent(),
                            claim.getCreatedAt(),
                            cycleReportNum,
                            claim.getStatus(),
                            hasComment);
                })
                .toList();
    }


    @Transactional(readOnly = true)
    public AdminClaimDetailResponse getClaimDetail(Long claimId) {
        if (claimId == null || claimId <= 0) {
            throw new AdminException(INVALID_CLAIM_ID);
        }

        // 제보와 작성자, 자전거 정보를 함께 조회한다.
        ClaimEntity claim = claimRepository.findById(claimId)
                .orElseThrow(() -> new AdminException(NOT_EXISTS_CLAIM));
        // 제보에 직접 연결된 자전거와 작성자를 가져온다.
        String cycleId = claim.getCycleEntity() == null ? null : claim.getCycleEntity().getCycleId();
        Long userId = claim.getUserEntity().getUserId();
        String nickname = claim.getUserEntity().getNickname();

        String photoUrl = null;
        if (claim.getPath() != null && !claim.getPath().isBlank()) {
            photoUrl = s3Service.createDownloadUrl(claim.getPath());
        }

        // 해당 제보를 신고한 사용자 목록을 최신순으로 반환한다.
        List<AdminClaimReportResponse> reports = claimReportRepository
                .findAllByClaimEntity_ClaimIdOrderByCreatedAtDescClaimReportIdDesc(claimId)
                .stream()
                .map(report -> new AdminClaimReportResponse(
                        report.getClaimReportId(),
                        report.getReportCategory(),
                        report.getCreatedAt(),
                        report.getUserEntity().getUserId(),
                        report.getUserEntity().getNickname()))
                .toList();

        return new AdminClaimDetailResponse(
                claim.getClaimId(), claim.getClaimType(), cycleId, userId, nickname, claim.getCreatedAt(),
                claim.getContent(), claim.getStatus(),
                claim.getAdminComment(), photoUrl, reports);
    }


    @Transactional(readOnly = true)
    public List<AdminClaimResponse> getClaimList(
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
        Sort sort = Sort.by(direction, "createdAt").and(Sort.by(direction, "claimId"));

        // 검색 조건을 DB에 적용하고 요청한 생성일 순서로 조회한다.
        return claimRepository
                .findAllForAdmin(nicknameFilter, cycleIdFilter, statusFilter, sort)
                .stream()
                .map(claim -> {
                    // 제보 신고 건수와 관리자 코멘트 존재 여부를 목록에 함께 표시한다.
                    long reportCount = claimReportRepository
                            .countByClaimEntity_ClaimId(claim.getClaimId());
                    String comment = claim.getAdminComment();
                    boolean hasComment = comment != null && !comment.isBlank();

                    return new AdminClaimResponse(
                            claim.getClaimId(),
                            claim.getClaimType(),
                            claim.getUserEntity().getUserId(),
                            claim.getUserEntity().getNickname(),
                            claim.getCycleEntity() == null ? null : claim.getCycleEntity().getCycleId(),
                            claim.getClaimCategory(),
                            claim.getContent(),
                            claim.getCreatedAt(),
                            reportCount,
                            claim.getStatus(),
                            hasComment);
                })
                .toList();
    }


    @Transactional
    public AdminClaimUpdateResponse updateCycleClaim(
            Long claimId, AdminClaimUpdateRequest request) {
        // 대상과 필수 상태를 검증한 뒤 영속 엔티티의 상태·코멘트를 변경한다.
        if (claimId == null || claimId <= 0) {
            throw new AdminException(INVALID_CLAIM_ID);
        }
        if (request == null || request.statement() == null) {
            throw new AdminException(INVALID_CLAIM_STATUS);
        }

        ClaimEntity claim = claimRepository.findById(claimId)
                .orElseThrow(() -> new AdminException(NOT_EXISTS_CLAIM));
        claim.updateReview(request.statement(), request.content());
        return new AdminClaimUpdateResponse(claim.getClaimId());
    }


    ////////////////////////////////////
    private String normalizeSearchText(String value) {
        if (value == null) {
            return "";
        }
        return value.strip();
    }

}
