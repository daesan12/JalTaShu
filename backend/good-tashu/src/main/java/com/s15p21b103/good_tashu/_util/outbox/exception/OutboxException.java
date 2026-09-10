package com.s15p21b103.good_tashu._util.outbox.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public class OutboxException extends RuntimeException{
    private final OutboxErrorCode errorCode;
}
