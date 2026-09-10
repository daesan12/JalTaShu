package com.s15p21b103.good_tashu.cycle.dto.req;

import com.s15p21b103.good_tashu.cycle.domain.Category;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.multipart.MultipartFile;

public record CycleClaimRequest(
        @NotBlank String cycleId,
        @NotNull Category category,
        @NotBlank String content,
        MultipartFile file
) {
}
