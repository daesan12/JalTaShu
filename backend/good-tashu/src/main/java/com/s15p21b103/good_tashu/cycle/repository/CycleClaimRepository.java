package com.s15p21b103.good_tashu.cycle.repository;

import com.s15p21b103.good_tashu.cycle.domain.CycleClaimEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CycleClaimRepository extends JpaRepository<CycleClaimEntity, Long> {
    @EntityGraph(attributePaths = "userEntity")
    List<CycleClaimEntity> findAllByCycleEntity_CycleIdOrderByCreatedAtDescIdDesc(String cycleId);
}
