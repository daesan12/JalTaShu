package com.s15p21b103.good_tashu.claim.repository;

import com.s15p21b103.good_tashu.claim.domain.ClaimEntity;
import com.s15p21b103.good_tashu.claim.domain.ClaimStatus;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClaimRepository extends JpaRepository<ClaimEntity, Long> {
    @Override
    @EntityGraph(attributePaths = {
            "cycleEntity", "userEntity"
    })
    Optional<ClaimEntity> findById(Long claimId);

    @EntityGraph(attributePaths = {
            "cycleEntity", "userEntity"
    })
    List<ClaimEntity> findAllByCycleEntity_CycleIdOrderByCreatedAtDescClaimIdDesc(String cycleId);

    // 기타 제보도 포함하도록 자전거는 LEFT JOIN으로 조회한다.
    @Query("""
            SELECT claim
            FROM ClaimEntity claim
            LEFT JOIN FETCH claim.cycleEntity cycle
            JOIN FETCH claim.userEntity user
            WHERE (:nickname = '' OR LOWER(user.nickname) LIKE LOWER(CONCAT('%', :nickname, '%')))
              AND (:cycleId = '' OR LOWER(cycle.cycleId) LIKE LOWER(CONCAT('%', :cycleId, '%')))
              AND (:status IS NULL OR claim.status = :status)
            """)
    List<ClaimEntity> findAllForAdmin(
            @Param("nickname") String nickname,
            @Param("cycleId") String cycleId,
            @Param("status") ClaimStatus status,
            Sort sort);
}
