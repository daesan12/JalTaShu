package com.s15p21b103.good_tashu.admin.exception;

import lombok.Getter;

@Getter
public class AdminException extends RuntimeException {
    private final AdminErrorCode errorCode;

    public AdminException(AdminErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}
