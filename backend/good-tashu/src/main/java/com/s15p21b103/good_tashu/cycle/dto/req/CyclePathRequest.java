package com.s15p21b103.good_tashu.cycle.dto.req;

import com.s15p21b103.good_tashu.path.domain.PathInfo;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.LocalDateTime;

public record CyclePathRequest (
    @NotNull @Valid
    PathInfo pathInfo,
    @NotNull
    LocalDateTime createdAt,
    @NotNull
    LocalDateTime finishedAt,
    @NotNull @PositiveOrZero
    Integer totalDistance,
    @NotNull @PositiveOrZero
    Integer bikeDistance
) {
    @AssertTrue(message = "종료 시각은 시작 시각보다 빠를 수 없습니다.")
    public boolean isTimeOrderValid() {
        return createdAt == null || finishedAt == null || !finishedAt.isBefore(createdAt);
    }

    @AssertTrue(message = "자전거 거리는 전체 거리보다 클 수 없습니다.")
    public boolean isDistanceValid() {
        return totalDistance == null || bikeDistance == null || bikeDistance <= totalDistance;
    }
}
