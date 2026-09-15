package com.s15p21b103.good_tashu.notice.dto.res;

import java.time.LocalDateTime;

public record NoticeListResponse(
        Long noticeId,
        String title,
        String author,
        LocalDateTime createdAt
) {
}
