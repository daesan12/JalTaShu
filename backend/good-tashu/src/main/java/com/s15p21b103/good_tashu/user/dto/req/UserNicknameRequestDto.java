package com.s15p21b103.good_tashu.user.dto.req;

import jakarta.validation.constraints.*;
import org.hibernate.validator.constraints.Length;

public record  UserNicknameRequestDto(
        @NotNull @Size(min = 2, max = 10) @Pattern(regexp="^[a-zA-Z0-9ㄱ-ㅎ가-힣]*$")
        String nickname
) { }
