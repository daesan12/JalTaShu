package com.s15p21b103.good_tashu.cycle.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum CycleErrorCode {
    NOT_EXIST_CYCLE_ID(HttpStatus.NOT_FOUND, "해당 ID의 자전거가 존재하지 않습니다"),
    CYCLE_NOT_READY(HttpStatus.BAD_REQUEST, "대여 가능상태가 아닌 자전거입니다.");

    private final HttpStatus status;
    private final String message;
}
