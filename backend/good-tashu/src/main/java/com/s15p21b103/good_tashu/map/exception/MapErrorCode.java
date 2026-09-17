package com.s15p21b103.good_tashu.map.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum MapErrorCode {
    INVALID_REROUTE_REQUEST(HttpStatus.BAD_REQUEST, "현재 상태, 탐색 유형 또는 이동에 필요한 정류소 ID가 올바르지 않습니다."),
    INVALID_PATH_COORDINATES(HttpStatus.BAD_REQUEST, "출발지 또는 도착지 좌표가 올바르지 않습니다."),
    PATH_STATION_NOT_FOUND(HttpStatus.NOT_FOUND, "좌표가 있는 대여소를 찾을 수 없습니다."),
    PATH_NOT_FOUND(HttpStatus.NOT_FOUND, "이동 가능한 경로를 찾을 수 없습니다."),
    OSRM_API_ERROR(HttpStatus.BAD_GATEWAY, "OSRM 경로 요청에 실패했습니다."),
    OSRM_API_TIMEOUT(HttpStatus.GATEWAY_TIMEOUT, "OSRM 응답 시간이 초과되었습니다."),
    OSRM_RESPONSE_INVALID(HttpStatus.BAD_GATEWAY, "OSRM 응답 형식이 올바르지 않습니다."),
    DEM_DATA_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "고도 데이터를 읽을 수 없습니다."),
    DEM_COVERAGE_MISSING(HttpStatus.UNPROCESSABLE_ENTITY, "경로가 고도 데이터 범위를 벗어났습니다."),
    INVALID_RECENT_PLACE_LIMIT(HttpStatus.BAD_REQUEST, "조회 개수는 1 이상이어야 합니다."),
    SEARCH_QUERY_REQUIRED(HttpStatus.BAD_REQUEST, "검색어를 입력해주세요."),
    NOT_EXISTS_RECENT_PLACE(HttpStatus.NOT_FOUND, "최근 검색어의 장소를 찾을 수 없습니다."),
    NAVER_API_ERROR(HttpStatus.BAD_GATEWAY, "네이버 장소 검색 요청에 실패했습니다."),
    NAVER_API_TIMEOUT(HttpStatus.GATEWAY_TIMEOUT, "네이버 장소 검색 응답 시간이 초과되었습니다."),
    NAVER_RESPONSE_INVALID(HttpStatus.BAD_GATEWAY, "네이버 장소 검색 응답 형식이 올바르지 않습니다.");

    private final HttpStatus status;
    private final String message;
}
