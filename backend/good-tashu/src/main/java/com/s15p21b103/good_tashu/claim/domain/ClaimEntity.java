package com.s15p21b103.good_tashu.claim.domain;

import com.s15p21b103.good_tashu.cycle.domain.CycleEntity;
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
@Table(name = "claims")
public class ClaimEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "claim_id")
    private Long claimId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity userEntity;

    @Column(name="type", nullable = false)
    @Enumerated(EnumType.STRING)
    private ClaimType claimType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cycle_id")
    private CycleEntity cycleEntity;

    @Column(name = "category", nullable = true)
    @Enumerated(EnumType.STRING)
    private ClaimCategory claimCategory;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "status", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private ClaimStatus status;

    @Column(name = "path", length = 255)
    private String path;

    @Column(name = "created_at")
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "admin_comment", length = 255)
    private String adminComment;

    public void updateReview(ClaimStatus status, String adminComment) {
        this.status = status;
        if (adminComment != null) {
            this.adminComment = adminComment;
        }
    }
}
