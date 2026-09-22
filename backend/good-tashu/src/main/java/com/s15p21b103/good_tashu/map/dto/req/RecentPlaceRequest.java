package com.s15p21b103.good_tashu.map.dto.req;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record RecentPlaceRequest(
        @NotBlank @Size(max = 100) String title,
        @Size(max = 100) String address,
        @Size(max = 100) String roadAddress,
        @DecimalMin("-180") @DecimalMax("180") @Digits(integer = 3, fraction = 7) BigDecimal xPos,
        @DecimalMin("-90") @DecimalMax("90") @Digits(integer = 3, fraction = 7) BigDecimal yPos
) {
}
