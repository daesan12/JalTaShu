package com.s15p21b103.good_tashu.user.dto.res;

import java.math.BigDecimal;

public record UserMeResponse(
        String nickname,
        Long monthlyMoveCnt,
        BigDecimal monthlyMoveDis,
        Long monthlyTime
) {
}
