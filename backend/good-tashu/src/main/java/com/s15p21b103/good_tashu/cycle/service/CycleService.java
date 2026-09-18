package com.s15p21b103.good_tashu.cycle.service;

import com.s15p21b103.good_tashu._util.service.S3Service;
import com.s15p21b103.good_tashu.cycle.domain.*;
import com.s15p21b103.good_tashu.cycle.dto.req.CyclePathRequest;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleRentalRequest;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleReturnRequest;
import com.s15p21b103.good_tashu.cycle.event.CycleRentalStartedEvent;
import com.s15p21b103.good_tashu.cycle.event.CycleReturnEvent;
import com.s15p21b103.good_tashu.cycle.exception.CycleException;
import com.s15p21b103.good_tashu.claim.repository.ClaimRepository;
import com.s15p21b103.good_tashu.claim.repository.ClaimReportRepository;
import com.s15p21b103.good_tashu.cycle.repository.CycleRepository;
import com.s15p21b103.good_tashu.cycle.repository.CycleUsageRepository;
import com.s15p21b103.good_tashu.cycle.repository.CycleUsageRepository.UsageStatistics;
import com.s15p21b103.good_tashu.cycle.repository.StationRepository;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.exception.UserException;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import org.springframework.transaction.annotation.Transactional;
import com.s15p21b103.good_tashu.path.domain.PathEntity;
import com.s15p21b103.good_tashu.path.domain.PathInfo;
import com.s15p21b103.good_tashu.path.repository.PathRepository;
import com.s15p21b103.good_tashu.cycle.dto.res.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

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
    private final ClaimRepository cycleClaimRepository;
    private final ClaimReportRepository cycleClaimReportRepository;
    private final S3Service s3Service;
    private final PathRepository pathRepository;

    @Transactional(readOnly = true)
    public CycleStatisticsResponse getStatistics(Long userId) {
        // 전체 GPS JSON을 읽지 않고 DB에서 완료된 이용내역 집계
        UsageStatistics statistics = cycleUsageRepository.getUsageStatistics(userId);
        return new CycleStatisticsResponse(statistics.getTotalUseCnt(),
                statistics.getTotalDistance(), statistics.getTotalCycleRidingTime());
    }

    @Transactional(readOnly = true)
    public List<CycleUsageListResponse> getUsageList(Long userId) {
        // 최근 대여일 순으로 이용내역을 목록 응답으로 변환
        return cycleUsageRepository.findByUserEntity_UserIdAndReturnAtIsNotNullOrderByRentalAtDesc(userId)
                .stream().map(usage -> {
            return new CycleUsageListResponse(usage.getCycleUsageId(), point(usage.getRentalStationEntity()), point(usage.getReturnStationEntity()),
                    usage.getRentalAt(), durationSeconds(usage), usage.getCycleEntity().getCycleId());
        }).toList();
    }

    @Transactional(readOnly = true)
    public CycleUsageDetailResponse getUsageDetail(Long userId, Long usageId) {
        // 요청한 이용내역이 로그인 사용자 소유인지 확인
        CycleUsageEntity usage = cycleUsageRepository.findByCycleUsageIdAndUserEntity_UserId(usageId, userId)
                .orElseThrow(() -> new CycleException(NOT_EXIST_USAGE));
        // 이용내역에 연결된 GPS 경로 조회
        PathEntity path = pathRepository.findByCycleUsage_CycleUsageId(usage.getCycleUsageId()).orElse(null);
        int seconds = durationSeconds(usage);
        Integer distance = null;
        Integer bikeDistance = null;
        PathInfo pathInfo = null;
        if (path != null) {
            distance = path.getTotalDistance();
            bikeDistance = path.getBikeDistance();
            pathInfo = path.getPathInfo();
        }
        // 도보 거리를 제외한 자전거 거리(m)와 대여~반납 시간(s)으로 km/h 계산
        BigDecimal speed = null;
        if (bikeDistance != null && seconds > 0) {
            speed = BigDecimal.valueOf(bikeDistance).multiply(new BigDecimal("3.6"))
                    .divide(BigDecimal.valueOf(seconds), 2, RoundingMode.HALF_UP);
        }
        return new CycleUsageDetailResponse(seconds, distance, point(usage.getRentalStationEntity()),
                point(usage.getReturnStationEntity()), usage.getRentalAt(), usage.getCycleEntity().getCycleId(), speed,
                pathInfo, usage.getRentalAt(), usage.getReturnAt());
    }

    // 대여 시각부터 반납 시각까지의 초 단위 이용시간
    private int durationSeconds(CycleUsageEntity usage) {
        if (usage.getRentalAt() == null || usage.getReturnAt() == null)
            return 0;
        return (int) Duration.between(usage.getRentalAt(), usage.getReturnAt()).getSeconds();
    }

    //대여소의 위도,경도 얻기
    private CyclePointResponse point(StationEntity station) {
        if (station == null) {
            return null;
        }
        return new CyclePointResponse(station.getLatitude(), station.getLongitude());
    }

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
    public void savePathTrace(Long userId, CyclePathRequest request) {
        UserEntity user = userRepository.findById(userId)
            .orElseThrow(() -> new UserException(NOT_EXISTS_USER));
        CycleUsageEntity cycleUsage = cycleUsageRepository.findFirstByUserEntity_UserIdAndReturnAtIsNotNullOrderByReturnAtDescCycleUsageIdDesc(userId)
                .orElseThrow(() -> new CycleException(NOT_EXIST_USAGE));

        if (pathRepository.findByCycleUsage_CycleUsageId(cycleUsage.getCycleUsageId()).isPresent()) {
            throw new CycleException(PATH_ALREADY_EXISTS);
        }

        pathRepository.save(
                PathEntity.builder()
                        .user(user)
                        .pathInfo(request.pathInfo())
                        .cycleUsage(cycleUsage)
                        .createdAt(request.createdAt())
                        .finishedAt(request.finishedAt())
                        .totalDistance(request.totalDistance())
                        .bikeDistance(request.bikeDistance())
                        .build()
        );
    }
}
