package com.s15p21b103.good_tashu.claim.dto.req;

import jakarta.validation.constraints.NotBlank;
import org.hibernate.validator.constraints.Length;

public record EtcClaimRequest(@NotBlank @Length(max = 500) String content) {}
