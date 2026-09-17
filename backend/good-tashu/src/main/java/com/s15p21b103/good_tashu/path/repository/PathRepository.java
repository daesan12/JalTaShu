package com.s15p21b103.good_tashu.path.repository;

import com.s15p21b103.good_tashu.path.domain.PathEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PathRepository extends JpaRepository<PathEntity, Long> {
    Optional<PathEntity> findByCycleUsage_CycleUsageId(Long cycleUsageId);

}
