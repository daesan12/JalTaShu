package com.s15p21b103.good_tashu.cycle.domain;

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
@Table(name = "cycle_claims")
public class CycleClaimEntity  {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cycle_claim_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_usage_id", nullable = false)
    private CycleUsageEntity cycleUsageEntity;

    @Column(name = "category", nullable = false)
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
