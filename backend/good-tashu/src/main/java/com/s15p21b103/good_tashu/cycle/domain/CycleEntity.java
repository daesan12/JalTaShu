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
    @JoinColumn(name = "station_id", nullable = false)
    private StationEntity stationEntity;

}
