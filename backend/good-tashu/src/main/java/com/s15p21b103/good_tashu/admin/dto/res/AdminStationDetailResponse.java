package com.s15p21b103.good_tashu.admin.dto.res;

// yesterday는 조회 시점으로부터 24시간 전을 기준으로 한다.
public record AdminStationDetailResponse(
        String stationName,
        Long currentBikeCnt,
        Long todayRentalCnt,
        Long todayReturnCnt,
        Long currentReportCnt,
        Long yesterdayBikeCnt,
        Long yesterdayRentalCnt,
        Long yesterdayReturnCnt,
        Long yesterdayReportCnt
) {
}
