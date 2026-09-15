package com.s15p21b103.good_tashu.cycle.service;

import com.s15p21b103.good_tashu._util.service.S3Service;
import com.s15p21b103.good_tashu.cycle.domain.*;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleClaimRequest;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleRentalRequest;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleReturnRequest;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleClaimResponse;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleClaimListResponse;
import com.s15p21b103.good_tashu.cycle.event.CycleRentalStartedEvent;
import com.s15p21b103.good_tashu.cycle.event.CycleReturnEvent;
import com.s15p21b103.good_tashu.cycle.exception.CycleException;
import com.s15p21b103.good_tashu.cycle.repository.CycleClaimRepository;
import com.s15p21b103.good_tashu.cycle.repository.CycleClaimReportRepository;
import com.s15p21b103.good_tashu.cycle.repository.CycleRepository;
import com.s15p21b103.good_tashu.cycle.repository.CycleUsageRepository;
import com.s15p21b103.good_tashu.cycle.repository.StationRepository;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.exception.UserException;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;

import static com.s15p21b103.good_tashu.cycle.exception.CycleErrorCode.*;
import static com.s15p21b103.good_tashu.user.exception.UserErrorCode.NOT_EXISTS_USER;

@Service
@RequiredArgsConstructor
public class CycleService {
    private final CycleRepository cycleRepository;
    private final CycleUsageRepository cycleUsageRepository;
    private final UserRepository userRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final StationRepository stationRepository;
    private final CycleClaimRepository cycleClaimRepository;
    private final CycleClaimReportRepository cycleClaimReportRepository;
    private final S3Service s3Service;

    //TODO: 동시성 처리
    @Transactional
    public LocalDateTime rentalCycle(Long userId, CycleRentalRequest request) {
        UserEntity userEntity = userRepository.findById(userId)
                .orElseThrow(() -> new UserException(NOT_EXISTS_USER));

        //조회
        CycleEntity cycleEntity = cycleRepository.findById(request.cycleId())
                .orElseThrow(() -> new CycleException(NOT_EXIST_CYCLE_ID));

        //자전거 대여가능상태 확인
        if(cycleEntity.getStatus() != CycleStatus.READY) {
            throw new CycleException(CYCLE_NOT_READY);
        }

        //해당 사용자가 이미 빌린 자전거 있는지 확인
        if (cycleUsageRepository.existsByUserEntity_UserIdAndReturnAtIsNull(userId)) {
            throw new CycleException(ALREADY_RENTING);
        }

        //이용 내역 저장
        LocalDateTime currentTime = LocalDateTime.now();
        cycleUsageRepository.save(CycleUsageEntity.builder()
                .userEntity(userEntity)
                .cycleEntity(cycleEntity)
                .rentalStationEntity(cycleEntity.getStationEntity())
                .rentalAt(currentTime)
                .build());

        //대여 상태 변경
        cycleEntity.startRental();

        //알림 전송
        eventPublisher.publishEvent(new CycleRentalStartedEvent(userId, currentTime));

        return currentTime;
    }

    @Transactional
    public LocalDateTime returnCycle(Long userId, CycleReturnRequest request) {
        UserEntity userEntity = userRepository.findById(userId)
                .orElseThrow(() -> new UserException(NOT_EXISTS_USER));

        //조회
        CycleEntity cycleEntity = cycleRepository.findById(request.cycleId())
                .orElseThrow(() -> new CycleException(NOT_EXIST_CYCLE_ID));
        StationEntity stationEntity = stationRepository.findById(request.stationId())
                .orElseThrow(() -> new CycleException(NOT_EXIST_STATION_ID));

        //자전거 상태 확인
        if(cycleEntity.getStatus() != CycleStatus.RENTING) {
            throw new CycleException(CYCLE_NOT_RENTING);
        }

        //해당 사용자가 빌리고 있는 자전거 인지 확인
        CycleUsageEntity cycleUsageEntity = cycleUsageRepository.findByUserEntityAndCycleEntityAndReturnAtIsNull(userEntity, cycleEntity)
                .orElseThrow(() -> new CycleException(CYCLE_NOT_RENTING));

        //대여 상태 변경
        cycleEntity.returnRental(stationEntity);

        //반납 기록 저장
        LocalDateTime currentTime = LocalDateTime.now();
        cycleUsageEntity.returning(stationEntity, currentTime);

        //알림 전송
        eventPublisher.publishEvent(new CycleReturnEvent(userId, currentTime));

        return currentTime;
    }

    @Transactional
    public CycleClaimResponse claimCycle(Long userId, CycleClaimRequest request) {
        UserEntity userEntity = userRepository.findById(userId)
                .orElseThrow(() -> new UserException(NOT_EXISTS_USER));
        //조회
        CycleEntity cycleEntity = cycleRepository.findById(request.cycleId())
                .orElseThrow(() -> new CycleException(NOT_EXIST_CYCLE_ID));

        //탑승기록확인
        //자전거 이용 완료 이후 1일이내에 작성 가능함
        LocalDateTime now = LocalDateTime.now();

        if(!(cycleUsageRepository.existsByUserEntityAndCycleEntityAndReturnAtBetween(
                userEntity, cycleEntity, now.minusDays(1), now))) {
            throw new CycleException(CANT_WRITE_CLAIM);
        }

        MultipartFile photo = request.file();

        String path = null;
        if (photo != null && !photo.isEmpty()) {
            path = s3Service.uploadImage(photo);
        }

        CycleClaimEntity cycleClaimEntity = CycleClaimEntity.builder()
                .cycleEntity(cycleEntity)
                .userEntity(userEntity)
                .claimCategory(request.claimCategory())
                .content(request.content())
                .status(ClaimStatus.READY)
                .path(path)
                .build();

        CycleClaimEntity save = cycleClaimRepository.save(cycleClaimEntity);
        return new CycleClaimResponse(save.getId());
    }

    @Transactional
    public List<CycleClaimListResponse> getCycleClaims(String cycleId) {
        if (cycleId == null || cycleId.isBlank()) {
            throw new CycleException(CYCLE_ID_REQUIRED);
        }
        if (!cycleRepository.existsById(cycleId)) {
            throw new CycleException(NOT_EXIST_CYCLE_ID);
        }

        return cycleClaimRepository.findAllByCycleEntity_CycleIdOrderByCreatedAtDescIdDesc(cycleId)
                .stream()
                .map(claim -> new CycleClaimListResponse(
                        claim.getId(),
                        claim.getUserEntity().getNickname(),
                        claim.getClaimCategory(),
                        claim.getContent(),
                        claim.getCreatedAt()))
                .toList();
    }

    @Transactional
    public void reportCycleClaim(Long userId, Long claimId, ClaimReportCategory claimCategory) {
        if (claimCategory == null) {
            throw new CycleException(CLAIM_REPORT_CATEGORY_REQUIRED);
        }

        UserEntity userEntity = userRepository.findById(userId)
                .orElseThrow(() -> new UserException(NOT_EXISTS_USER));
        CycleClaimEntity cycleClaimEntity = cycleClaimRepository.findById(claimId)
                .orElseThrow(() -> new CycleException(NOT_EXIST_CLAIM_ID));

        cycleClaimReportRepository.save(CycleClaimReportEntity.builder()
                .cycleClaimEntity(cycleClaimEntity)
                .userEntity(userEntity)
                .claimCategory(claimCategory)
                .build());
    }
}
