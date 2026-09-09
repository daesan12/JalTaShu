package com.s15p21b103.good_tashu.cycle.service;

import com.s15p21b103.good_tashu.cycle.domain.CycleEntity;
import com.s15p21b103.good_tashu.cycle.domain.CycleUsageEntity;
import com.s15p21b103.good_tashu.cycle.domain.StationEntity;
import com.s15p21b103.good_tashu.cycle.domain.Status;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleRentalRequest;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleReturnRequest;
import com.s15p21b103.good_tashu.cycle.event.CycleRentalStartedEvent;
import com.s15p21b103.good_tashu.cycle.event.CycleReturnEvent;
import com.s15p21b103.good_tashu.cycle.exception.CycleException;
import com.s15p21b103.good_tashu.cycle.repository.CycleRepository;
import com.s15p21b103.good_tashu.cycle.repository.CycleUsageRepository;
import com.s15p21b103.good_tashu.cycle.repository.StationRepository;
import com.s15p21b103.good_tashu.fcm.domain.FcmTokenEntity;
import com.s15p21b103.good_tashu.fcm.dto.req.FcmMessageRequest;
import com.s15p21b103.good_tashu.fcm.repository.FcmTokenRepository;
import com.s15p21b103.good_tashu.fcm.service.FcmService;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.exception.UserException;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import jakarta.transaction.Transactional;
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

    //TODO: 동시성 처리
    @Transactional
    public LocalDateTime rentalCycle(Long userId, CycleRentalRequest request) {
        UserEntity userEntity = userRepository.findById(userId)
                .orElseThrow(() -> new UserException(NOT_EXISTS_USER));

        //조회
        CycleEntity cycleEntity = cycleRepository.findById(request.cycleId())
                .orElseThrow(() -> new CycleException(NOT_EXIST_CYCLE_ID));

        //자전거 대여가능상태 확인
        if(cycleEntity.getStatus() != Status.READY) {
            throw new CycleException(CYCLE_NOT_READY);
        }

        //해당 사용자가 이미 빌린 자전거 있는지 확인
        if (cycleUsageRepository.existsByUserEntity_UserIdAndReturnAtIsNull(userId)) {
            throw new CycleException(ALREADY_RENTING);
        }

        //대여 상태 변경
        cycleEntity.startRental();
        //이용 내역 저장
        LocalDateTime currentTime = LocalDateTime.now();
        cycleUsageRepository.save(CycleUsageEntity.builder()
                .userEntity(userEntity)
                .cycleEntity(cycleEntity)
                .rentalStationEntity(cycleEntity.getStationEntity())
                .rentalAt(currentTime)
                .build());

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
        if(cycleEntity.getStatus() != Status.RENTING) {
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


}
