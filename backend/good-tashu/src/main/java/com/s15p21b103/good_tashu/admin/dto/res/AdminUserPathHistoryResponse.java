package com.s15p21b103.good_tashu.admin.dto.res;

import java.time.LocalDateTime;
import java.util.List;

public record AdminUserPathHistoryResponse (
    Long totalUsingDistance,
  List<PathInfo> pathsList

  ) {
    public record PathInfo(
            LocalDateTime usingAt,
            String startingPoint,
            String endPoint,
            String cycleId,
            Integer totalDuration,
            Integer cycleDuration
    ) {}
}
