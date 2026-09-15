package com.s15p21b103.good_tashu.user.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
        name = "users",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_users_provider_id",
                columnNames = {"provider", "provider_user_id"}
        )
)
public class UserEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name="user_id")
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name="provider", nullable = false, length = 10)
    private SocialLoginProvider provider;

    @Column(name = "provider_user_id", nullable = false)
    private String providerUserId;

    @Column(name="nickname", nullable = true)
    @Setter
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(name="role", nullable = false, length = 10)
    @Setter
    private UserRole role;

    @Column(name="created_at")
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Builder
    public UserEntity(
            SocialLoginProvider provider,
            String providerUserId,
            String nickname,
            UserRole role
    ) {
        this.provider = provider;
        this.providerUserId = providerUserId;
        this.nickname = nickname;
        this.role = role;
    }

    @OneToMany(mappedBy = "user", cascade = CascadeType.REMOVE, orphanRemoval = true)
    List<UserTermEntity> userTerms;
}
