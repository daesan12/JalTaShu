package com.s15p21b103.good_tashu.claim.dto.req;

import com.s15p21b103.good_tashu.claim.domain.ClaimCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.validator.constraints.Length;
import org.springframework.web.multipart.MultipartFile;

public record CycleClaimRequest(
        @NotBlank String cycleId,
        @NotNull ClaimCategory claimCategory,
        @NotBlank @Length(max = 500) String content,
        MultipartFile file
) {
}
