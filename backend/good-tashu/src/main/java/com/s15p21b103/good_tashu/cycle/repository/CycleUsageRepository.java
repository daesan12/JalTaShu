package com.s15p21b103.good_tashu.cycle.repository;

import com.s15p21b103.good_tashu.cycle.domain.CycleEntity;
import com.s15p21b103.good_tashu.cycle.domain.CycleUsageEntity;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CycleUsageRepository extends JpaRepository<CycleUsageEntity, Long> {
    interface UsageStatistics {
        Long getTotalUseCnt();
        Long getTotalDistance();
        Long getTotalCycleRidingTime();
    }

    // 완료된 이용만 집계. 거리 미수집 기록이 있으면 총거리는 미확정(null).
    @Query(value = """
            SELECT COUNT(*) AS totalUseCnt,
                   CASE WHEN COUNT(*) = 0 THEN 0
                        WHEN COUNT(p.total_distance) < COUNT(*) THEN NULL
                        ELSE SUM(p.total_distance) END AS totalDistance,
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
    boolean existsByUserEntity_UserIdAndReturnAtIsNull(Long userId);

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
            WHERE cu.userId = :userId AND cu.return_at IS NOT NULL
            """,
            nativeQuery = true
    )
    Long sumUsageTimeByUserEntity_UserId(Long userId);
}
