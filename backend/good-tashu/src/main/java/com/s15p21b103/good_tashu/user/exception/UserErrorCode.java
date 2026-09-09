package com.s15p21b103.good_tashu.user.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum UserErrorCode {
    UNSUPPORTED_OAUTH_PROVIDER(HttpStatus.BAD_REQUEST, "지원하지 않는 소셜 로그인입니다."),
    OAUTH_LOGIN_FAILED(HttpStatus.UNAUTHORIZED, "소셜 로그인에 실패했습니다."),

    NOT_AGREE_REQUIRED_TERMS(HttpStatus.BAD_REQUEST, "필수 약관에 모두 동의하지 않았습니다."),

    NOT_EXISTS_USER(HttpStatus.NOT_FOUND, "존재하지 않는 사용자입니다."),
    PASSWORD_MISMATCH(HttpStatus.BAD_REQUEST, "비밀번호가 일치하지 않습니다."),
    INVALID_LOGIN_CREDENTIALS(HttpStatus.BAD_REQUEST, "이메일 또는 비밀번호가 올바르지 않습니다."),
    INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "Refresh Token이 유효하지 않습니다."),

    FORBIDDEN(HttpStatus.FORBIDDEN, "해당 요청에 권한이 없습니다.");

    private final HttpStatus status;
    private final String message;
}
