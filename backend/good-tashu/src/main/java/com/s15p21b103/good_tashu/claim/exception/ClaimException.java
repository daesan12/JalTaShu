package com.s15p21b103.good_tashu.claim.exception;

import lombok.Getter;

@Getter
public class ClaimException extends RuntimeException {
    private final ClaimErrorCode errorCode;

    public ClaimException(ClaimErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}
