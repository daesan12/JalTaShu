package com.s15p21b103.good_tashu.admin.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum AdminErrorCode {
    NOT_EXISTS_ADMIN(HttpStatus.NOT_FOUND, "존재하지 않는 관리자입니다."),
    NOT_EXISTS_USER(HttpStatus.NOT_FOUND, "존재하지 않는 사용자입니다."),
    ALREADY_BANNED(HttpStatus.CONFLICT, "이미 제재 중인 사용자입니다."),
    INVALID_STATEMENT(HttpStatus.BAD_REQUEST, "statement는 BANNED 또는 NORMAL만 가능합니다."),
    INVALID_ORDER(HttpStatus.BAD_REQUEST, "order는 newest 또는 oldest만 가능합니다."),
    INVALID_DATE(HttpStatus.BAD_REQUEST, "datetime을 입력해주세요."),
    INVALID_STATION_ID(HttpStatus.BAD_REQUEST, "대여소 ID를 입력해주세요."),
    NOT_EXISTS_STATION(HttpStatus.NOT_FOUND, "존재하지 않는 대여소입니다."),
    INVALID_TERM(HttpStatus.BAD_REQUEST, "term은 day 또는 week만 가능합니다."),
    INVALID_CYCLE_STATEMENT(HttpStatus.BAD_REQUEST, "statement는 READY 또는 RENTING만 가능합니다.");
    private final HttpStatus status;
    private final String message;
}
