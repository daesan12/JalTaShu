package com.s15p21b103.good_tashu.map.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum MapErrorCode {
    INVALID_RECENT_PLACE_LIMIT(HttpStatus.BAD_REQUEST, "조회 개수는 1 이상이어야 합니다."),
    SEARCH_QUERY_REQUIRED(HttpStatus.BAD_REQUEST, "검색어를 입력해주세요."),
    NAVER_API_ERROR(HttpStatus.BAD_GATEWAY, "네이버 장소 검색 요청에 실패했습니다."),
    NAVER_API_TIMEOUT(HttpStatus.GATEWAY_TIMEOUT, "네이버 장소 검색 응답 시간이 초과되었습니다."),
    NAVER_RESPONSE_INVALID(HttpStatus.BAD_GATEWAY, "네이버 장소 검색 응답 형식이 올바르지 않습니다.");

    private final HttpStatus status;
    private final String message;
}
