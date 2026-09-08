package com.s15p21b103.good_tashu._util.fcm.domain;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
public class FcmTokenEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    //@JoinColumn()
    //private User userId;

    private String token;

    private Platform platform;

    @Column(name = "device_id")
    private String deviceId;

    private String enabled;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

