package com.s15p21b103.good_tashu.path.repository;

import com.s15p21b103.good_tashu.path.domain.PathEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PathRepository extends JpaRepository<PathEntity, Long> {
    interface HistoryRow {
        LocalDateTime getCreatedAt();
        LocalDateTime getFinishedAt();
        LocalDateTime getRentalAt();
        LocalDateTime getReturnAt();
        String getStartingPoint();
        String getEndPoint();
        String getCycleId();
        Integer getTotalDistance();
    }

    // GPS JSON과 연관 엔티티를 로딩하지 않고 목록에 필요한 값만 조회한다.
    @Query("""
            SELECT p.createdAt AS createdAt, p.finishedAt AS finishedAt,
                   cu.rentalAt AS rentalAt, cu.returnAt AS returnAt,
                   rental.name AS startingPoint, returned.name AS endPoint,
                   cycle.cycleId AS cycleId, p.totalDistance AS totalDistance
            FROM PathEntity p
            LEFT JOIN p.cycleUsage cu ON cu.userEntity.userId = :userId
            LEFT JOIN cu.rentalStationEntity rental
            LEFT JOIN cu.returnStationEntity returned
            LEFT JOIN cu.cycleEntity cycle
            WHERE p.user.userId = :userId
            ORDER BY p.createdAt DESC, p.pathId DESC
            """)
    List<HistoryRow> findHistoryRowsByUserId(@Param("userId") Long userId);

    Optional<PathEntity> findByCycleUsage_CycleUsageId(Long cycleUsageId);

}
