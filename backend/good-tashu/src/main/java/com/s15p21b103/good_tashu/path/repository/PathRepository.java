package com.s15p21b103.good_tashu.path.repository;

import com.s15p21b103.good_tashu.path.domain.PathEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.util.Optional;

public interface PathRepository extends JpaRepository<PathEntity, Long> {
    Optional<PathEntity> findByCycleUsage_CycleUsageId(Long cycleUsageId);

    // MySQL REPEATABLE READ에서도 잠금 대기 중 커밋된 경로를 최신 상태로 읽는다.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<PathEntity> findForUpdateByCycleUsage_CycleUsageId(Long cycleUsageId);
}
