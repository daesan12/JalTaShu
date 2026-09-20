package com.s15p21b103.good_tashu.claim.service;

import com.s15p21b103.good_tashu._util.service.S3Service;
import com.s15p21b103.good_tashu.claim.domain.ClaimEntity;
import com.s15p21b103.good_tashu.claim.domain.ClaimReportEntity;
import com.s15p21b103.good_tashu.claim.domain.ClaimStatus;
import com.s15p21b103.good_tashu.claim.dto.req.CycleClaimRequest;
import com.s15p21b103.good_tashu.claim.dto.req.AbandonedClaimRequest;
import com.s15p21b103.good_tashu.claim.dto.req.EtcClaimRequest;
import com.s15p21b103.good_tashu.claim.dto.res.ClaimListResponse;
import com.s15p21b103.good_tashu.claim.dto.res.ClaimResponse;
import com.s15p21b103.good_tashu.claim.repository.ClaimReportRepository;
import com.s15p21b103.good_tashu.claim.repository.ClaimRepository;
import com.s15p21b103.good_tashu.cycle.domain.CycleEntity;
import lombok.RequiredArgsConstructor;
import com.s15p21b103.good_tashu.cycle.exception.CycleException;
import com.s15p21b103.good_tashu.claim.exception.ClaimException;
import com.s15p21b103.good_tashu.cycle.repository.CycleRepository;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.exception.UserException;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import com.s15p21b103.good_tashu.claim.domain.*;

import java.util.List;

import static com.s15p21b103.good_tashu.cycle.exception.CycleErrorCode.*;
import static com.s15p21b103.good_tashu.claim.exception.ClaimErrorCode.*;
import static com.s15p21b103.good_tashu.user.exception.UserErrorCode.NOT_EXISTS_USER;

@Service
@RequiredArgsConstructor
public class ClaimService {
    private final UserRepository userRepository;
    private final S3Service s3Service;
    private final ClaimRepository claimRepository;
    private final CycleRepository cycleRepository;
    private final ClaimReportRepository claimReportRepository;

    // 자전거 고장 제보
    @Transactional
    public ClaimResponse claimCycle(Long userId, CycleClaimRequest request) {

        UserEntity user = findUser(userId);
        // cycleId
        CycleEntity cycle = findCycle(request.cycleId());

        return saveClaim(user, cycle, ClaimType.CYCLE, request.claimCategory(), request.content(), request.file());
    }

    @Transactional
    public ClaimResponse claimAbandoned(Long userId, AbandonedClaimRequest request) {
        return saveClaim(findUser(userId), findCycle(request.cycleId()), ClaimType.ABANDONED,
                null, request.content(), request.file());
    }

    @Transactional
    public ClaimResponse claimEtc(Long userId, EtcClaimRequest request) {
        return saveClaim(findUser(userId), null, ClaimType.ETC, null, request.content(), null);
    }

    private UserEntity findUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new UserException(NOT_EXISTS_USER));
    }

    private CycleEntity findCycle(String cycleId) {
        if (cycleId == null || cycleId.isBlank()) throw new CycleException(CYCLE_ID_REQUIRED);
        return cycleRepository.findById(cycleId).orElseThrow(() -> new CycleException(NOT_EXIST_CYCLE_ID));
    }

    private ClaimResponse saveClaim(UserEntity user, CycleEntity cycle, ClaimType type,
                                    ClaimCategory category, String content, MultipartFile photo) {
        String path = null;
        if (photo != null && !photo.isEmpty()) {
            path = s3Service.uploadImage(photo);
        }

        ClaimEntity cycleClaimEntity = ClaimEntity.builder()
                .userEntity(user)
                .cycleEntity(cycle)
                .claimType(type)
                .claimCategory(category)
                .content(content)
                .status(ClaimStatus.READY)
                .path(path)
                .build();

        ClaimEntity save = claimRepository.save(cycleClaimEntity);
        return new ClaimResponse(save.getClaimId());
    }

    @Transactional(readOnly = true)
    public List<ClaimListResponse> getCycleClaims(String cycleId) {
        if (cycleId == null || cycleId.isBlank()) {
            throw new CycleException(CYCLE_ID_REQUIRED);
        }
        if (!cycleRepository.existsById(cycleId)) {
            throw new CycleException(NOT_EXIST_CYCLE_ID);
        }

        return claimRepository
                .findAllByCycleEntity_CycleIdOrderByCreatedAtDescClaimIdDesc(cycleId)
                .stream()
                .map(claim -> new ClaimListResponse(
                        claim.getClaimId(),
                        claim.getClaimType(),
                        claim.getUserEntity().getNickname(),
                        claim.getClaimCategory(),
                        claim.getContent(),
                        claim.getCreatedAt()))
                .toList();
    }

    @Transactional
    public void reportClaim(Long userId, Long claimId, ClaimReportCategory claimCategory) {
        if (claimCategory == null) {
            throw new ClaimException(CLAIM_REPORT_CATEGORY_REQUIRED);
        }

        UserEntity userEntity = userRepository.findById(userId)
                .orElseThrow(() -> new UserException(NOT_EXISTS_USER));
        ClaimEntity claimEntity = claimRepository.findById(claimId)
                .orElseThrow(() -> new ClaimException(NOT_EXIST_CLAIM_ID));

        if (claimReportRepository.existsByClaimEntity_ClaimIdAndUserEntity_UserId(claimId, userId)) {
            throw new ClaimException(ALREADY_REPORTED_CLAIM);
        }
        // 동시 요청이 사전 검사를 통과하더라도 DB 유니크 제약이 중복 저장을 막는다.
        claimReportRepository.save(ClaimReportEntity.builder()
                .claimEntity(claimEntity)
                .userEntity(userEntity)
                .reportCategory(claimCategory)
                .build());

    }
}
