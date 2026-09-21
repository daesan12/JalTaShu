package com.s15p21b103.good_tashu.path.domain;

import com.s15p21b103.good_tashu.cycle.domain.CycleUsageEntity;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
@Table(name = "paths", uniqueConstraints = @UniqueConstraint(
        name = "uk_paths_cycle_usage_id", columnNames = "cycle_usage_id"))
public class PathEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "path_id")
    private Long pathId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "path_info", columnDefinition = "json")
    private PathInfo pathInfo;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cycle_usage_id")
    private CycleUsageEntity cycleUsage;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    @Column(name = "total_distance")
    private Integer totalDistance;

    @Column(name = "bike_distance")
    private Integer bikeDistance;
}
