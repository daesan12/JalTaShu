package com.s15p21b103.good_tashu.fcm.dto;

import jakarta.validation.constraints.NotBlank;

public record FcmMessageRequest(
        @NotBlank String token,
        @NotBlank String title,
        @NotBlank String body
) {
}
