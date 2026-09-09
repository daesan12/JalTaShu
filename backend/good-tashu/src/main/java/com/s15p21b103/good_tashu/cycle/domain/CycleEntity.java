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
public class CycleEntity {
    @Id
    @Column(name = "cycle_id")
    private String cycleId;

    @Setter
    @Enumerated(EnumType.STRING)
    private Status status;

    @CreationTimestamp
    @Column(name = "registered_at")
    private LocalDateTime registeredAt;

    @ManyToOne
    @JoinColumn(name = "station_id")
    private StationEntity stationEntity;

    public void startRental() {
        this.status = Status.RENTING;
        this.stationEntity = null;
    }
    public void returnRental(StationEntity stationEntity) {
        this.status = Status.READY;
        this.stationEntity = stationEntity;
    }
}
