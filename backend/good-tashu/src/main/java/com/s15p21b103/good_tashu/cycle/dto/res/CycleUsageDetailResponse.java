package com.s15p21b103.good_tashu.cycle.dto.res;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import com.s15p21b103.good_tashu.path.domain.PathInfo;
public record CycleUsageDetailResponse
        (Integer totalDuration,
         Integer totalDistance,
         CyclePointResponse startingPoint,
         CyclePointResponse endPoint,
         LocalDateTime startingDate,
         String cycleId,
         BigDecimal averageCycleRidingSpeed,
         PathInfo pathInfo,
         LocalDateTime cycleRidingStartTime,
         LocalDateTime cycleRidingEndTime
        )
{}
