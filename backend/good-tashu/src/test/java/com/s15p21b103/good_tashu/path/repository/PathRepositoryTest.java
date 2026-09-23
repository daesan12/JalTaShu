package com.s15p21b103.good_tashu.path.repository;

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

@DataJpaTest(properties = "spring.flyway.enabled=false")
class PathRepositoryTest {
    @Autowired
    private EntityManager entityManager;

    @Autowired
    private PathRepository pathRepository;

    @Test
    void historyStartsFromCycleUsagesAndKeepsMissingPathFieldsNull() {
        UserEntity user = UserEntity.builder()
                .provider(SocialLoginProvider.KAKAO)
                .providerUserId("path-history-user")
                .nickname("history-user")
                .role(UserRole.USER)
                .build();
        entityManager.persist(user);

        StationEntity rentalStation = StationEntity.builder()
                .stationId("S1")
                .name("출발 대여소")
                .build();
        StationEntity returnStation = StationEntity.builder()
                .stationId("S2")
                .name("도착 대여소")
                .build();
        entityManager.persist(rentalStation);
        entityManager.persist(returnStation);

        CycleEntity firstCycle = CycleEntity.builder()
                .cycleId("C1")
                .status(CycleStatus.READY)
                .stationEntity(returnStation)
                .build();
        CycleEntity secondCycle = CycleEntity.builder()
                .cycleId("C2")
                .status(CycleStatus.RENTING)
                .build();
        entityManager.persist(firstCycle);
        entityManager.persist(secondCycle);

        LocalDateTime firstRentalAt = LocalDateTime.of(2026, 9, 20, 10, 0);
        CycleUsageEntity usageWithPath = CycleUsageEntity.builder()
                .userEntity(user)
                .cycleEntity(firstCycle)
                .rentalStationEntity(rentalStation)
                .returnStationEntity(returnStation)
                .rentalAt(firstRentalAt)
                .returnAt(firstRentalAt.plusMinutes(20))
                .build();
        CycleUsageEntity usageWithoutPath = CycleUsageEntity.builder()
                .userEntity(user)
                .cycleEntity(secondCycle)
                .rentalStationEntity(rentalStation)
                .rentalAt(firstRentalAt.plusDays(1))
                .build();
        entityManager.persist(usageWithPath);
        entityManager.persist(usageWithoutPath);

        entityManager.persist(PathEntity.builder()
                .user(user)
                .cycleUsage(usageWithPath)
                .createdAt(firstRentalAt.minusMinutes(5))
                .finishedAt(firstRentalAt.plusMinutes(25))
                .totalDistance(3_000)
                .bikeDistance(2_000)
                .build());
        entityManager.flush();
        entityManager.clear();

        var rows = pathRepository.findHistoryRowsByUserId(user.getUserId());

        assertThat(rows).hasSize(2);
        assertThat(rows.getFirst().getCycleId()).isEqualTo("C2");
        assertThat(rows.getFirst().getRentalAt()).isEqualTo(firstRentalAt.plusDays(1));
        assertThat(rows.getFirst().getStartingPoint()).isEqualTo("출발 대여소");
        assertThat(rows.getFirst().getReturnAt()).isNull();
        assertThat(rows.getFirst().getEndPoint()).isNull();
        assertThat(rows.getFirst().getCreatedAt()).isNull();
        assertThat(rows.getFirst().getFinishedAt()).isNull();
        assertThat(rows.getFirst().getTotalDistance()).isNull();

        assertThat(rows.get(1).getCycleId()).isEqualTo("C1");
        assertThat(rows.get(1).getStartingPoint()).isEqualTo("출발 대여소");
        assertThat(rows.get(1).getEndPoint()).isEqualTo("도착 대여소");
        assertThat(rows.get(1).getTotalDistance()).isEqualTo(3_000);
    }
}
