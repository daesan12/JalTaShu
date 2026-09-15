package com.s15p21b103.good_tashu.fcm.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum FcmErrorCode {
    NOT_EXIST_TOKEN(HttpStatus.NOT_FOUND, "토큰이 존재하지 않습니다"),
    NOT_AVAILABLE_TOKEN(HttpStatus.BAD_REQUEST, "토큰이 활성화 되어있지않습니다."),
    FAIL_TRANSFER_FCM_MESSAGE(HttpStatus.INTERNAL_SERVER_ERROR, "FCM메시지 전송에 실패하였습니다."),
    TOKEN_DEACTIVATE_FORBIDDEN(HttpStatus.BAD_REQUEST,"본인의 토큰만 비활성화 할 수 있습니다.");

    private final HttpStatus status;
    private final String message;
}
