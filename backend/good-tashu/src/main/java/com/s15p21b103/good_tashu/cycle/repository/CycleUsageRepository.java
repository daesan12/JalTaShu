package com.s15p21b103.good_tashu.cycle.repository;

import com.s15p21b103.good_tashu.cycle.domain.CycleEntity;
import com.s15p21b103.good_tashu.cycle.domain.CycleUsageEntity;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CycleUsageRepository extends JpaRepository<CycleUsageEntity, Long> {
    interface UsageStatistics {
        Long getTotalUseCnt();
        Long getTotalDistance();
        Long getTotalCycleRidingTime();
    }

    interface MonthlyMoveStatistics {
        Long getMonthlyMoveCnt();
        Long getMonthlyMoveDisMeters();
        Long getMonthlyTimeSeconds();
    }

    // 반납일이 이번 달인 완료 이용만 집계한다.
    // 거리는 경로가 저장된 이용만 더한다(#153). 경로 없이 QR로만 대여·반납한 이용이 하나라도 있으면
    // 합계 전체를 null로 비우던 정책은, 쌓아 둔 거리가 화면에서 사라져 보여 "아는 것만 합산"으로 바꿨다.
    @Query(value = """
            SELECT COUNT(*) AS monthlyMoveCnt,
                   COALESCE(SUM(p.total_distance), 0) AS monthlyMoveDisMeters,
                   COALESCE(SUM(TIMESTAMPDIFF(SECOND, cu.rental_at, cu.return_at)), 0)
                       AS monthlyTimeSeconds
            FROM cycle_usages cu
            LEFT JOIN paths p ON p.cycle_usage_id = cu.cycle_usage_id AND p.user_id = cu.user_id
            WHERE cu.user_id = :userId
              AND cu.return_at >= :monthStart
              AND cu.return_at < :nextMonthStart
            """, nativeQuery = true)
    MonthlyMoveStatistics getMonthlyMoveStatistics(
            @Param("userId") Long userId,
            @Param("monthStart") LocalDateTime monthStart,
            @Param("nextMonthStart") LocalDateTime nextMonthStart);

    // 완료된 이용만 집계. 거리는 경로가 저장된 이용만 더한다(#153) — 위 월별 통계와 같은 이유.
    @Query(value = """
            SELECT COUNT(*) AS totalUseCnt,
                   COALESCE(SUM(p.total_distance), 0) AS totalDistance,
                   COALESCE(SUM(TIMESTAMPDIFF(SECOND, cu.rental_at, cu.return_at)), 0) AS totalCycleRidingTime
            FROM cycle_usages cu
            LEFT JOIN paths p ON p.cycle_usage_id = cu.cycle_usage_id AND p.user_id = cu.user_id
            WHERE cu.user_id = :userId AND cu.return_at IS NOT NULL
            """, nativeQuery = true)
    UsageStatistics getUsageStatistics(@Param("userId") Long userId);

    @EntityGraph(attributePaths = {"cycleEntity", "rentalStationEntity", "returnStationEntity"})
    Optional<CycleUsageEntity> findByCycleUsageIdAndUserEntity_UserId(Long usageId, Long userId);

    @EntityGraph(attributePaths = {"cycleEntity", "rentalStationEntity", "returnStationEntity"})
    List<CycleUsageEntity> findByUserEntity_UserIdAndReturnAtIsNotNullOrderByRentalAtDesc(Long userId);

    @EntityGraph(attributePaths = {"rentalStationEntity", "returnStationEntity"})
    Optional<CycleUsageEntity> findFirstByCycleEntity_CycleIdOrderByRentalAtDescCycleUsageIdDesc(
            String cycleId);

    boolean existsByUserEntity_UserIdAndReturnAtIsNull(Long userId);

    // 반납 전인 대여 — 앱이 기억한 "빌린 자전거"를 서버 기준으로 맞출 때 쓴다
    @EntityGraph(attributePaths = {"cycleEntity"})
    Optional<CycleUsageEntity> findFirstByUserEntity_UserIdAndReturnAtIsNullOrderByRentalAtDescCycleUsageIdDesc(
            Long userId);

    Optional<CycleUsageEntity> findByUserEntityAndCycleEntityAndReturnAtIsNull(
            UserEntity userEntity,
            CycleEntity cycleEntity
    );

    // 반납 시간 기준 최신
    Optional<CycleUsageEntity> findFirstByUserEntity_UserIdAndReturnAtIsNotNullOrderByReturnAtDescCycleUsageIdDesc(
            Long userId
    );

    // 대여 시간 기준 최신
    Optional<CycleUsageEntity> findFirstByUserEntity_UserIdAndRentalAtIsNotNullOrderByReturnAtDescCycleUsageIdDesc(
            Long userId
    );

    // 이용 횟수
    Integer countByUserEntity_UserId(Long userId);
    
    // 누적 이용 시간
    @Query(value= """
            SELECT SUM(TIMESTAMPDIFF(MINUTE, cu.rental_at, cu.return_at))
            FROM cycle_usages cu
            WHERE cu.user_id = :userId AND cu.return_at IS NOT NULL
            """,
            nativeQuery = true
    )
    Long sumUsageTimeByUserEntity_UserId(Long userId);
}
