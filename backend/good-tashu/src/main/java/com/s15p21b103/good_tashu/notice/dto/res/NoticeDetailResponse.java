package com.s15p21b103.good_tashu.notice.dto.res;

import java.time.LocalDateTime;

public record NoticeDetailResponse(
        String title,
        String author,
        LocalDateTime createdAt,
        String content
) {
}
