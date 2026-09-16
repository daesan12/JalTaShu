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
    NOT_EXISTS_ADMIN(HttpStatus.NOT_FOUND, "존재하지 않는 관리자입니다."),
    NOT_EXISTS_USER(HttpStatus.NOT_FOUND, "존재하지 않는 사용자입니다."),
    ALREADY_BANNED(HttpStatus.CONFLICT, "이미 제재 중인 사용자입니다."),
    INVALID_STATEMENT(HttpStatus.BAD_REQUEST, "statement는 BANNED 또는 NORMAL만 가능합니다."),
    INVALID_ORDER(HttpStatus.BAD_REQUEST, "order는 newest 또는 oldest만 가능합니다.");
    private final HttpStatus status;
    private final String message;
}
