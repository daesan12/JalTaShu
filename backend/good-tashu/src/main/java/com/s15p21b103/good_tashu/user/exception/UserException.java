package com.s15p21b103.good_tashu.user.exception;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@Getter
public class UserException extends RuntimeException {
    private final UserErrorCode errorCode;
}