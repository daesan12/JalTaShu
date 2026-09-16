package com.s15p21b103.good_tashu.cycle.repository;

import com.s15p21b103.good_tashu.cycle.domain.CycleClaimReportEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CycleClaimReportRepository extends JpaRepository<CycleClaimReportEntity, Long> {
    long countByCycleClaimEntity_Id(Long cycleClaimId);

    @EntityGraph(attributePaths = "userEntity")
    List<CycleClaimReportEntity> findAllByCycleClaimEntity_IdOrderByCreatedAtDescIdDesc(Long cycleClaimId);
}
