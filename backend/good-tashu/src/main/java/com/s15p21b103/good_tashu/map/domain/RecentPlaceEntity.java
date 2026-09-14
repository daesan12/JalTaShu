package com.s15p21b103.good_tashu.map.domain;

import com.s15p21b103.good_tashu.user.domain.UserEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "recent_places", indexes = @Index(name = "idx_recent_places_user_created", columnList = "user_id, created_at"))
public class RecentPlaceEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "recent_place_id")
    private Long recentPlaceId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "place", nullable = false, length = 100)
    private String place;

    @Column(name = "address", length = 100)
    private String address;

    @Column(name = "road_address", length = 100)
    private String roadAddress;

    @Column(name = "longitude", precision = 10, scale = 7)
    private BigDecimal longitude;

    @Column(name = "latitude", precision = 10, scale = 7)
    private BigDecimal latitude;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public RecentPlaceEntity(UserEntity user, String place, String address, String roadAddress,
                             BigDecimal longitude, BigDecimal latitude) {
        this.user = user;
        this.place = place;
        this.address = address;
        this.roadAddress = roadAddress;
        this.longitude = longitude;
        this.latitude = latitude;
    }
}
