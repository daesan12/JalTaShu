package com.s15p21b103.good_tashu.cycle.dto.res;
import java.time.LocalDateTime;
public record CycleUsageListResponse(Long usageId, CyclePointResponse startingPoint, CyclePointResponse endPoint,
                                     LocalDateTime startingDate, Integer totalDuration, String cycleId) {}
