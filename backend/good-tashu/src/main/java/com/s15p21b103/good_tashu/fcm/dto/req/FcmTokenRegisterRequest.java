package com.s15p21b103.good_tashu.fcm.dto.req;

import com.s15p21b103.good_tashu.fcm.domain.Platform;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record FcmTokenRegisterRequest(
        @NotBlank String token,
        @NotNull Platform platform,
        @NotBlank String deviceId
) {

}
