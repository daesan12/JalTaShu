package com.s15p21b103.good_tashu.cycle.domain;

import com.s15p21b103.good_tashu.user.domain.UserEntity;
import jakarta.persistence.*;
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
@Table(name = "cycle_usages")
public class CycleUsageEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cycle_usage_id")
    private Long cycleUsageId;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private UserEntity userEntity;

    @ManyToOne
    @JoinColumn(name = "cycle_id", nullable = false)
    private CycleEntity cycleEntity;

    @ManyToOne
    @JoinColumn(name = "rental_station_id")
    private StationEntity rentalStationEntity;

    @ManyToOne
    @JoinColumn(name = "return_station_id")
    private StationEntity returnStationEntity;

    @Column(name = "rental_at", nullable = false)
    private LocalDateTime rentalAt;

    @Column(name = "return_at")
    private LocalDateTime returnAt;

    public void returning(StationEntity returnStationEntity, LocalDateTime returnAt) {
        this.returnStationEntity = returnStationEntity;
        this.returnAt = returnAt;
    }
}
