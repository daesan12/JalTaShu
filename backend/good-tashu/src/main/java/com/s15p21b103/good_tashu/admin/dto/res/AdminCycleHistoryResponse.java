package com.s15p21b103.good_tashu.admin.dto.res;

import java.time.LocalDateTime;

public record AdminCycleHistoryResponse(
        Long recordId,
        LocalDateTime usingAt,
        String startingPoint,
        String endPoint,
        Long userId,
        String nickname
) {
}
