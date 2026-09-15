package com.s15p21b103.good_tashu._util.outbox.dispatcher;

import com.s15p21b103.good_tashu._util.outbox.domain.OutboxEventEntity;
import com.s15p21b103.good_tashu._util.outbox.domain.OutboxEventType;
import com.s15p21b103.good_tashu._util.outbox.exception.OutboxErrorCode;
import com.s15p21b103.good_tashu._util.outbox.exception.OutboxException;
import com.s15p21b103.good_tashu._util.outbox.handler.OutboxEventHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class OutboxEventDispatcher {
    private final Map<OutboxEventType, OutboxEventHandler> handlers;

    public OutboxEventDispatcher(List<OutboxEventHandler> handlerList) {
        Map<OutboxEventType, OutboxEventHandler> registered =
                new EnumMap<>(OutboxEventType.class);

        for (OutboxEventHandler handler : handlerList) {
            OutboxEventHandler previous =
                    registered.putIfAbsent(handler.eventType(), handler);

            if (previous != null) {
                throw new OutboxException(OutboxErrorCode.DUPLICATED_OUTBOX_HANDLER);
            }
        }

        this.handlers = Map.copyOf(registered);
    }
    public void dispatch(OutboxEventEntity event) {
        OutboxEventHandler handler = handlers.get(event.getEventType());

        if(handler == null)
            throw new OutboxException(OutboxErrorCode.NOT_SUPPORTED_OUTBOX_EVENT);
        handler.handle(event);
    }
}
