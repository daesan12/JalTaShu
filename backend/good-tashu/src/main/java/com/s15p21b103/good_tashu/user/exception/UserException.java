package com.s15p21b103.good_tashu.user.exception;
import lombok.Getter;

@Getter
public class UserException extends RuntimeException {
    private final UserErrorCode errorCode;

    public UserException(UserErrorCode errorCode) {
        this(errorCode, errorCode.getMessage());
    }

    public UserException(UserErrorCode errorCode, String message) {
        super(message == null || message.isBlank() ? errorCode.getMessage() : message);
        this.errorCode = errorCode;
    }
}
