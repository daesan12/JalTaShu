package com.s15p21b103.good_tashu.fcm.dto;

import jakarta.validation.constraints.NotBlank;

public record FcmMessageDto(
        @NotBlank String token,
        String title,
        String body,
        String data
) {
}
