package com.s15p21b103.good_tashu.cycle.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Table(name = "cycles")
public class CycleEntity {
    @Id
    @Column(name = "cycle_id")
    private String cycleId;

    @Setter
    @Enumerated(EnumType.STRING)
    private CycleStatus status;

    @CreationTimestamp
    @Column(name = "registered_at")
    private LocalDateTime registeredAt;

    @ManyToOne
    @JoinColumn(name = "station_id")
    private StationEntity stationEntity;

    public void startRental() {
        this.status = CycleStatus.RENTING;
        this.stationEntity = null;
    }
    public void returnRental(StationEntity stationEntity) {
        this.status = CycleStatus.READY;
        this.stationEntity = stationEntity;
    }
}
