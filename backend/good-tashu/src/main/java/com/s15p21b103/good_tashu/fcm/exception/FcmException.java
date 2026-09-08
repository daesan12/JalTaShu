package com.s15p21b103.good_tashu.fcm.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@Getter
public class FcmException extends RuntimeException {
    private final FcmErrorCode errorCode;
}
