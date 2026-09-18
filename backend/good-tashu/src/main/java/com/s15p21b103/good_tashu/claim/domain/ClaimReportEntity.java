package com.s15p21b103.good_tashu.claim.domain;

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
@Table(name = "claim_reports", uniqueConstraints = @UniqueConstraint(
        name = "uk_claim_reports_claim_user", columnNames = {"claim_id", "user_id"}))
public class ClaimReportEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "claim_report_id")
    private Long claimReportId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "claim_id", nullable = false)
    private ClaimEntity claimEntity;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity userEntity;

    @Enumerated(EnumType.STRING)
    @Column(name = "claim_category", nullable = false, length = 30)
    private ClaimReportCategory claimCategory;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
