package com.s15p21b103.good_tashu.cycle.repository;

import com.s15p21b103.good_tashu.cycle.domain.CycleClaimEntity;
import com.s15p21b103.good_tashu.cycle.domain.ClaimStatus;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CycleClaimRepository extends JpaRepository<CycleClaimEntity, Long> {
    @Override
    @EntityGraph(attributePaths = {
            "cycleUsageEntity",
            "cycleUsageEntity.cycleEntity",
            "cycleUsageEntity.userEntity"
    })
    Optional<CycleClaimEntity> findById(Long claimId);

    @EntityGraph(attributePaths = {
            "cycleUsageEntity",
            "cycleUsageEntity.cycleEntity",
            "cycleUsageEntity.userEntity"
    })
    List<CycleClaimEntity> findAllByCycleUsageEntity_CycleEntity_CycleIdOrderByCreatedAtDescIdDesc(String cycleId);

    // 필터를 DB에서 적용하고 이용 기록을 함께 가져와 목록 변환 시 추가 조회를 줄인다.
    @Query("""
            SELECT claim
            FROM CycleClaimEntity claim
            JOIN FETCH claim.cycleUsageEntity usage
            JOIN FETCH usage.cycleEntity cycle
            JOIN FETCH usage.userEntity user
            WHERE (:nickname = '' OR LOWER(user.nickname) LIKE LOWER(CONCAT('%', :nickname, '%')))
              AND (:cycleId = '' OR LOWER(cycle.cycleId) LIKE LOWER(CONCAT('%', :cycleId, '%')))
              AND (:status IS NULL OR claim.status = :status)
            """)
    List<CycleClaimEntity> findAllForAdmin(
            @Param("nickname") String nickname,
            @Param("cycleId") String cycleId,
            @Param("status") ClaimStatus status,
            Sort sort);
}
