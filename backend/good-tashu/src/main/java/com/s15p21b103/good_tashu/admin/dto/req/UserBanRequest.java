package com.s15p21b103.good_tashu.admin.dto.req;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

public record UserBanRequest(
        @NotNull @Future LocalDateTime scheduledEndAt,
        @Size(max = 100) String comment
) {
}
