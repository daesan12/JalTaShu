package com.s15p21b103.good_tashu.fcm.dto.req;

import jakarta.validation.constraints.NotBlank;

public record FcmTokenDeactivateRequest(
        @NotBlank String token
) {
}
