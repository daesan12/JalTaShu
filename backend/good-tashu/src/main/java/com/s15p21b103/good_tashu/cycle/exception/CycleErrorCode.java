package com.s15p21b103.good_tashu.cycle.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum CycleErrorCode {
    NOT_EXIST_USAGE(HttpStatus.NOT_FOUND, "이용내역을 찾을 수 없습니다."),
    CYCLE_ID_REQUIRED(HttpStatus.BAD_REQUEST, "자전거 ID를 입력해주세요."),
    CLAIM_REPORT_CATEGORY_REQUIRED(HttpStatus.BAD_REQUEST, "신고 카테고리를 선택해주세요."),
    NOT_EXIST_CYCLE_ID(HttpStatus.NOT_FOUND, "해당 ID의 자전거가 존재하지 않습니다"),
    NOT_EXIST_CLAIM_ID(HttpStatus.NOT_FOUND, "해당 ID의 제보가 존재하지 않습니다."),
    CYCLE_NOT_READY(HttpStatus.BAD_REQUEST, "대여 가능상태가 아닌 자전거입니다."),
    ALREADY_RENTING(HttpStatus.CONFLICT, "이미 대여 중인 자전거가 있습니다."),
    CYCLE_NOT_RENTING(HttpStatus.BAD_REQUEST, "대여 진행중인 자전거가 아닙니다." ),
    NOT_EXIST_STATION_ID(HttpStatus.NOT_FOUND, "해당 ID의 대여소가 존재하지 않습니다"),
    CANT_WRITE_CLAIM(HttpStatus.NOT_FOUND, "대여 완료 이후 1일 이내에 작성 가능합니다.");

    private final HttpStatus status;
    private final String message;
}
