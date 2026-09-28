package com.s15p21b103.good_tashu.cycle.repository;

import com.s15p21b103.good_tashu.cycle.domain.CycleEntity;
import com.s15p21b103.good_tashu.cycle.domain.CycleStatus;
import com.s15p21b103.good_tashu.cycle.domain.CycleUsageEntity;
import com.s15p21b103.good_tashu.cycle.domain.StationEntity;
import com.s15p21b103.good_tashu.path.domain.PathEntity;
import com.s15p21b103.good_tashu.user.domain.SocialLoginProvider;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.domain.UserRole;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 이용 통계 쿼리(#153) — 거리는 경로가 저장된 이용만 더한다.
 * 경로 없이 QR로만 대여·반납한 이용이 섞여도, 그동안 쌓인 거리가 사라지면 안 된다.
 */
@DataJpaTest(properties = "spring.flyway.enabled=false")
class CycleUsageStatisticsTest {
    @Autowired
    private EntityManager entityManager;

    @Autowired
    private CycleUsageRepository cycleUsageRepository;

    private UserEntity user(String providerUserId) {
        UserEntity user = UserEntity.builder()
                .provider(SocialLoginProvider.KAKAO)
                .providerUserId(providerUserId)
                .nickname(providerUserId)
                .role(UserRole.USER)
                .build();
        entityManager.persist(user);
        return user;
    }

    private CycleEntity cycle(String cycleId) {
        CycleEntity cycle = CycleEntity.builder()
                .cycleId(cycleId)
                .status(CycleStatus.READY)
                .build();
        entityManager.persist(cycle);
        return cycle;
    }

    @Test
    void distanceSumsOnlyUsagesThatHaveAPath() {
        UserEntity user = user("stats-user");
        StationEntity station = StationEntity.builder().stationId("S1").name("대여소").build();
        entityManager.persist(station);

        LocalDateTime rentalAt = LocalDateTime.of(2026, 9, 20, 10, 0);

        // 경로 안내를 거쳐 반납 — 경로와 거리가 있다
        CycleUsageEntity withPath = CycleUsageEntity.builder()
                .userEntity(user)
                .cycleEntity(cycle("C1"))
                .rentalStationEntity(station)
                .returnStationEntity(station)
                .rentalAt(rentalAt)
                .returnAt(rentalAt.plusMinutes(20))
                .build();
        // QR로만 대여·반납 — 경로가 없다
        CycleUsageEntity withoutPath = CycleUsageEntity.builder()
                .userEntity(user)
                .cycleEntity(cycle("C2"))
                .rentalStationEntity(station)
                .returnStationEntity(station)
                .rentalAt(rentalAt.plusHours(1))
                .returnAt(rentalAt.plusHours(1).plusMinutes(5))
                .build();
        // 아직 반납 전 — 통계에 들어가면 안 된다
        CycleUsageEntity renting = CycleUsageEntity.builder()
                .userEntity(user)
                .cycleEntity(cycle("C3"))
                .rentalStationEntity(station)
                .rentalAt(rentalAt.plusHours(2))
                .build();
        entityManager.persist(withPath);
        entityManager.persist(withoutPath);
        entityManager.persist(renting);
        entityManager.persist(PathEntity.builder()
                .user(user)
                .cycleUsage(withPath)
                .createdAt(rentalAt.minusMinutes(3))
                .finishedAt(rentalAt.plusMinutes(22))
                .totalDistance(1_982)
                .bikeDistance(1_500)
                .build());
        entityManager.flush();
        entityManager.clear();

        CycleUsageRepository.UsageStatistics total = cycleUsageRepository.getUsageStatistics(user.getUserId());

        assertThat(total.getTotalUseCnt()).isEqualTo(2L);
        // 경로 없는 이용이 섞여도 1982m는 그대로 남는다 — 예전엔 합계 전체가 null이 됐다
        assertThat(total.getTotalDistance()).isEqualTo(1_982L);
        assertThat(total.getTotalCycleRidingTime()).isEqualTo(20L * 60 + 5L * 60);

        CycleUsageRepository.MonthlyMoveStatistics monthly = cycleUsageRepository.getMonthlyMoveStatistics(
                user.getUserId(), LocalDateTime.of(2026, 9, 1, 0, 0), LocalDateTime.of(2026, 10, 1, 0, 0));

        assertThat(monthly.getMonthlyMoveCnt()).isEqualTo(2L);
        assertThat(monthly.getMonthlyMoveDisMeters()).isEqualTo(1_982L);
        assertThat(monthly.getMonthlyTimeSeconds()).isEqualTo(20L * 60 + 5L * 60);
    }

    @Test
    void userWithoutCompletedUsagesGetsZerosNotNulls() {
        UserEntity user = user("no-rides-user");
        entityManager.flush();
        entityManager.clear();

        CycleUsageRepository.UsageStatistics total = cycleUsageRepository.getUsageStatistics(user.getUserId());

        assertThat(total.getTotalUseCnt()).isZero();
        assertThat(total.getTotalDistance()).isZero();
        assertThat(total.getTotalCycleRidingTime()).isZero();
    }
}
