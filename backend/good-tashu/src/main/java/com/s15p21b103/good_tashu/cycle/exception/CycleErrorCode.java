package com.s15p21b103.good_tashu.cycle.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum CycleErrorCode {
    PATH_ALREADY_EXISTS(HttpStatus.CONFLICT, "해당 이용내역의 경로가 이미 저장되어 있습니다."),
    NOT_EXIST_USAGE(HttpStatus.NOT_FOUND, "이용내역을 찾을 수 없습니다."),
    USAGE_NOT_COMPLETED(HttpStatus.BAD_REQUEST, "반납이 완료된 이용에만 경로를 저장할 수 있습니다."),
    CYCLE_ID_REQUIRED(HttpStatus.BAD_REQUEST, "자전거 ID를 입력해주세요."),
    NOT_EXIST_CYCLE_ID(HttpStatus.NOT_FOUND, "해당 ID의 자전거가 존재하지 않습니다"),
    CYCLE_NOT_READY(HttpStatus.BAD_REQUEST, "대여 가능상태가 아닌 자전거입니다."),
    ALREADY_RENTING(HttpStatus.CONFLICT, "이미 대여 중인 자전거가 있습니다."),
    CYCLE_NOT_RENTING(HttpStatus.BAD_REQUEST, "대여 진행중인 자전거가 아닙니다." ),
    NOT_EXIST_STATION_ID(HttpStatus.NOT_FOUND, "해당 ID의 대여소가 존재하지 않습니다"),
    CURRENT_LOCATION_REQUIRED(HttpStatus.BAD_REQUEST, "현재 위치를 확인할 수 없습니다.");

    private final HttpStatus status;
    private final String message;
}
