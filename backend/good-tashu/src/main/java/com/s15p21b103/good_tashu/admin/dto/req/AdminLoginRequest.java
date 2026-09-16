package com.s15p21b103.good_tashu.admin.dto.req;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminLoginRequest(
        @NotBlank @Size(max = 20) String id,
        @NotBlank @Size(max = 72) String password
) {
    @Override
    public String toString() {
        return "AdminLoginRequest[credentials=REDACTED]";
    }
}
