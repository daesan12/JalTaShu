package com.s15p21b103.good_tashu.cycle.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@Getter
public class CycleException extends RuntimeException {
    private final CycleErrorCode errorCode;
}
