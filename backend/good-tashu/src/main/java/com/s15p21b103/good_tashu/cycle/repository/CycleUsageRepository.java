package com.s15p21b103.good_tashu.cycle.repository;

import com.s15p21b103.good_tashu.cycle.domain.CycleEntity;
import com.s15p21b103.good_tashu.cycle.domain.CycleUsageEntity;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface CycleUsageRepository extends JpaRepository<CycleUsageEntity, Long> {
    boolean existsByUserEntity_UserIdAndReturnAtIsNull(Long userId);

    Optional<CycleUsageEntity> findByUserEntityAndCycleEntityAndReturnAtIsNull(
            UserEntity userEntity,
            CycleEntity cycleEntity
    );

    boolean existsByUserEntityAndCycleEntityAndRentalAtBetween(
            UserEntity userEntity, CycleEntity cycleEntity,
            LocalDateTime from, LocalDateTime to);

    boolean existsByUserEntityAndCycleEntityAndReturnAtBetween(
            UserEntity userEntity, CycleEntity cycleEntity,
            LocalDateTime from, LocalDateTime to);
}
