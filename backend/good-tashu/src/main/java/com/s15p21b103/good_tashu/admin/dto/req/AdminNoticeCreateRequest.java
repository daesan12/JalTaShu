package com.s15p21b103.good_tashu.admin.dto.req;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminNoticeCreateRequest(
        @NotBlank @Size(max = 100) String title,
        @NotBlank String content
) {
}
