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

    // 길안내 경로가 없는 이용도 관리자 이용 기록에 포함되도록 이용 내역을 기준으로 조회한다.
    @Query("""
            SELECT p.createdAt AS createdAt, p.finishedAt AS finishedAt,
                   cu.rentalAt AS rentalAt, cu.returnAt AS returnAt,
                   rental.name AS startingPoint, returned.name AS endPoint,
                   cycle.cycleId AS cycleId, p.totalDistance AS totalDistance
            FROM CycleUsageEntity cu
            LEFT JOIN PathEntity p ON p.cycleUsage = cu
            LEFT JOIN cu.rentalStationEntity rental
            LEFT JOIN cu.returnStationEntity returned
            LEFT JOIN cu.cycleEntity cycle
            WHERE cu.userEntity.userId = :userId
            ORDER BY cu.rentalAt DESC, cu.cycleUsageId DESC
            """)
    List<HistoryRow> findHistoryRowsByUserId(@Param("userId") Long userId);

    Optional<PathEntity> findByCycleUsage_CycleUsageId(Long cycleUsageId);

}
