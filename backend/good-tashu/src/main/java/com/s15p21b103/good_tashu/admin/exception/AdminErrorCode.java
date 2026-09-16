package com.s15p21b103.good_tashu.admin.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum AdminErrorCode {
    INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "관리자 리프레시 토큰이 유효하지 않습니다."),
    INVALID_ADMIN_CREDENTIALS(HttpStatus.UNAUTHORIZED, "관리자 ID 또는 비밀번호가 올바르지 않습니다."),
    INVALID_ADMIN_ID(HttpStatus.BAD_REQUEST, "관리자 ID는 앞뒤 공백 제거 후 1~20자여야 합니다."),
    INVALID_ADMIN_PASSWORD(HttpStatus.BAD_REQUEST, "관리자 비밀번호는 공백만 사용할 수 없으며 UTF-8 기준 72바이트 이하여야 합니다."),
    INVALID_CLAIM_STATUS(HttpStatus.BAD_REQUEST,
            "status는 READY, IN_PROGRESS, COMPLETED 중 하나만 가능합니다."),
    INVALID_CLAIM_ID(HttpStatus.BAD_REQUEST, "제보 ID가 올바르지 않습니다."),
    NOT_EXISTS_CLAIM(HttpStatus.NOT_FOUND, "존재하지 않는 제보입니다."),
    NOT_EXISTS_ADMIN(HttpStatus.NOT_FOUND, "존재하지 않는 관리자입니다."),
    NOT_EXISTS_USER(HttpStatus.NOT_FOUND, "존재하지 않는 사용자입니다."),
    ALREADY_BANNED(HttpStatus.CONFLICT, "이미 제재 중인 사용자입니다."),
    INVALID_STATEMENT(HttpStatus.BAD_REQUEST, "statement는 BANNED 또는 NORMAL만 가능합니다."),
    INVALID_ORDER(HttpStatus.BAD_REQUEST, "order는 newest 또는 oldest만 가능합니다."),
    INVALID_DATE(HttpStatus.BAD_REQUEST, "datetime을 입력해주세요."),
    INVALID_STATION_ID(HttpStatus.BAD_REQUEST, "대여소 ID를 입력해주세요."),
    NOT_EXISTS_STATION(HttpStatus.NOT_FOUND, "존재하지 않는 대여소입니다."),
    INVALID_TERM(HttpStatus.BAD_REQUEST, "term은 day 또는 week만 가능합니다."),
    INVALID_CYCLE_STATEMENT(HttpStatus.BAD_REQUEST, "statement는 READY 또는 RENTING만 가능합니다."),
    INVALID_CYCLE_ID(HttpStatus.BAD_REQUEST, "자전거 ID를 입력해주세요."),
    NOT_EXISTS_CYCLE(HttpStatus.NOT_FOUND, "존재하지 않는 자전거입니다.");
    private final HttpStatus status;
    private final String message;
}
