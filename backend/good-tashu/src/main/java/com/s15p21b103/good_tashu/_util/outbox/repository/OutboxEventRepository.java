package com.s15p21b103.good_tashu._util.outbox.repository;

import com.s15p21b103.good_tashu._util.outbox.domain.OutboxEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEventEntity, Long> {
    List<OutboxEventEntity> findTop100ByOrderByOutboxEventIdAsc();
    List<OutboxEventEntity> findTop100ByOrderByAttemptCountAscOutboxEventIdAsc();

}
