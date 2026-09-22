package com.s15p21b103.good_tashu.admin.dto.res;

import java.time.LocalDateTime;

public record AdminNoticeListResponse(
        Long noticeId,
        String title,
        String author,
        LocalDateTime createdAt,
        Long popupId
) {
}
