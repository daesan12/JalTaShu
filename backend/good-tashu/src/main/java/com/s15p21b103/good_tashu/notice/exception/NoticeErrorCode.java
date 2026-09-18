package com.s15p21b103.good_tashu.notice.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum NoticeErrorCode {
    NOT_EXIST_NOTICE_ID(HttpStatus.NOT_FOUND, "해당 ID의 공지사항이 존재하지 않습니다."),
    NOTICE_HAS_POPUPS(HttpStatus.CONFLICT, "팝업에 연결된 공지사항은 삭제할 수 없습니다.");

    private final HttpStatus status;
    private final String message;
}
