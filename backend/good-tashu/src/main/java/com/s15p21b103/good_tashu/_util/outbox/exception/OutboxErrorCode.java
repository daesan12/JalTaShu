package com.s15p21b103.good_tashu._util.outbox.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum OutboxErrorCode {
    DUPLICATED_OUTBOX_HANDLER(HttpStatus.BAD_REQUEST, "중복 Outbox Handler"),
    NOT_SUPPORTED_OUTBOX_EVENT(HttpStatus.BAD_REQUEST, "지원되지 않는 Outbox Event");

    private final HttpStatus status;
    private final String message;
}
