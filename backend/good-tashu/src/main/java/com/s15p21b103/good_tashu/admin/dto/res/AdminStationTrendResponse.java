package com.s15p21b103.good_tashu.admin.dto.res;

import java.time.LocalDate;

public record AdminStationTrendResponse(
        // 오늘을 제외한 집계 대상 날짜
        LocalDate date,
        Long rentalCnt,
        Long returnCnt
) {
}
