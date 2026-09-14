package com.s15p21b103.good_tashu.admin.domain;

import com.s15p21b103.good_tashu.user.domain.UserEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "user_ban_records")
public class UserBanRecordEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "admin_id", nullable = false)
    private AdminEntity admin;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "released_at")
    private LocalDateTime releasedAt;

    @Column(name = "scheduled_end_at", nullable = false)
    private LocalDateTime scheduledEndAt;

    @Column(name = "comment", length = 100)
    private String comment;

    public UserBanRecordEntity(UserEntity user, AdminEntity admin,
                               LocalDateTime scheduledEndAt, String comment) {
        this.user = user;
        this.admin = admin;
        this.startedAt = LocalDateTime.now();
        this.scheduledEndAt = scheduledEndAt;
        this.comment = comment;
    }
}
