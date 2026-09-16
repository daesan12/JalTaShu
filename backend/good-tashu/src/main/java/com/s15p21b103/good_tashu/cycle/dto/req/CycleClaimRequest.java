package com.s15p21b103.good_tashu.cycle.dto.req;

import com.s15p21b103.good_tashu.cycle.domain.ClaimCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.hibernate.validator.constraints.Length;
import org.springframework.web.multipart.MultipartFile;

public record CycleClaimRequest(
        @NotNull @Positive Long usageId,
        @NotNull ClaimCategory claimCategory,
        @NotBlank @Length(max = 500) String content,
        MultipartFile file
) {
}
