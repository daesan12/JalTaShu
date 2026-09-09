package com.s15p21b103.good_tashu.cycle.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class StationLogEntity {
    @Id
    @Column(name = "station_log_id")
    private String stationLogId;

    @JoinColumn(name = "station_id", nullable = false)
    private StationEntity stationEntity;

    @Column(name = "cycle_cnt")
    private int cycleCnt;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
