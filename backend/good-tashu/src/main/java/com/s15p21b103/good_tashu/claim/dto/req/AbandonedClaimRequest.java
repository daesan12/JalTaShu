package com.s15p21b103.good_tashu.claim.dto.req;

import jakarta.validation.constraints.NotBlank;
import org.hibernate.validator.constraints.Length;
import org.springframework.web.multipart.MultipartFile;

public record AbandonedClaimRequest(
        @NotBlank String cycleId,
        @NotBlank @Length(max = 500) String content,
        MultipartFile file
) {}
