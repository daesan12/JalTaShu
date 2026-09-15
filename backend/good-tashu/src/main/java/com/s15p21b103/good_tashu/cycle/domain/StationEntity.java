package com.s15p21b103.good_tashu.cycle.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;


@Entity
@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Table(name = "stations")
public class StationEntity {
    @Id
    @Column(name = "station_id")
    private String stationId;

    @Column(nullable = false)
    private String name;

    @Column(precision = 10, scale = 6)
    private BigDecimal latitude;

    @Column(precision = 10, scale = 6)
    private BigDecimal longitude;

    private String address;
}
