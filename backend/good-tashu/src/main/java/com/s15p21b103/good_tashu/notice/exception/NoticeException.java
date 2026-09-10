package com.s15p21b103.good_tashu.notice.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public class NoticeException extends RuntimeException {
    private final NoticeErrorCode errorCode;
}
