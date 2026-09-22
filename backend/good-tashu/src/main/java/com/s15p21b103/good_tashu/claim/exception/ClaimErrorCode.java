package com.s15p21b103.good_tashu.claim.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum ClaimErrorCode {
    CLAIM_REPORT_CATEGORY_REQUIRED(HttpStatus.BAD_REQUEST, "신고 카테고리를 선택해주세요."),
    NOT_EXIST_CLAIM_ID(HttpStatus.NOT_FOUND, "해당 ID의 제보가 존재하지 않습니다."),
    ALREADY_REPORTED_CLAIM(HttpStatus.CONFLICT, "이미 신고한 제보입니다.");

    private final HttpStatus status;
    private final String message;
}
