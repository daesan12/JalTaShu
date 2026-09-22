package com.s15p21b103.good_tashu.map.exception;

import lombok.Getter;

@Getter
public class MapException extends RuntimeException {
    private final MapErrorCode errorCode;

    public MapException(MapErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public MapException(MapErrorCode errorCode, Throwable cause) {
        super(errorCode.getMessage(), cause);
        this.errorCode = errorCode;
    }
}
