package com.s15p21b103.good_tashu._util.outbox.service;

import com.s15p21b103.good_tashu._util.outbox.domain.OutboxEventEntity;
import com.s15p21b103.good_tashu._util.outbox.repository.OutboxEventRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OutboxRetryService {
    private final OutboxEventRepository outboxEventRepository;
    @Transactional
    public void scheduleRetry(Long eventId) {
        outboxEventRepository.findById(eventId)
                .ifPresent(OutboxEventEntity::scheduleRetry);
    }
}
