package com.s15p21b103.good_tashu._util.outbox.handler;

import com.s15p21b103.good_tashu._util.outbox.domain.OutboxEventEntity;
import com.s15p21b103.good_tashu._util.outbox.domain.OutboxEventType;

public interface OutboxEventHandler {
    OutboxEventType eventType();

    void handle(OutboxEventEntity event);
}
