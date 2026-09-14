package com.s15p21b103.good_tashu._util.outbox.service;

import com.s15p21b103.good_tashu._util.outbox.domain.OutboxEventEntity;
import com.s15p21b103.good_tashu._util.outbox.domain.OutboxEventType;
import com.s15p21b103.good_tashu._util.outbox.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
@RequiredArgsConstructor
public class OutboxEventService {
    private final OutboxEventRepository outboxEventRepository;
    private final JsonMapper jsonMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void append(
            OutboxEventType eventType,
            String aggregateId,
            Object payload
    ) {
        String json = payload == null
                ? null
                : jsonMapper.writeValueAsString(payload);

        outboxEventRepository.save(
                OutboxEventEntity.builder()
                        .eventType(eventType)
                        .aggregateId(aggregateId)
                        .payload(json)
                        .build()
        );
    }

}
