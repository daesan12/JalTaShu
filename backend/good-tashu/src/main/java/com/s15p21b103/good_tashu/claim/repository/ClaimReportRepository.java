package com.s15p21b103.good_tashu.claim.repository;

import com.s15p21b103.good_tashu.claim.domain.ClaimReportEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClaimReportRepository extends JpaRepository<ClaimReportEntity, Long> {
    long countByClaimEntity_ClaimId(Long claimId);

    boolean existsByClaimEntity_ClaimIdAndUserEntity_UserId(Long claimId, Long userId);

    @EntityGraph(attributePaths = "userEntity")
    List<ClaimReportEntity> findAllByClaimEntity_ClaimIdOrderByCreatedAtDescClaimReportIdDesc(Long claimId);
}
