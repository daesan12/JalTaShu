package com.s15p21b103.good_tashu.path.domain;

import java.math.BigDecimal;
import java.util.List;

public record PathInfo(List<PathPoint> road) {
    public record PathPoint(
            BigDecimal latitude,
            BigDecimal longitude,
            BigDecimal altitude,
            Mode mode,
            Integer seq
    ) {
    }

    public enum Mode {
        WALK, CYCLE
    }
}
