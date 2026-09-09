package com.s15p21b103.good_tashu.cycle.repository;

import com.s15p21b103.good_tashu.cycle.domain.CycleUsageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CycleUsageRepository extends JpaRepository<CycleUsageEntity, Long> {
    boolean existsByUserEntity_UserIdAndReturnAtIsNull(Long userId);
}
