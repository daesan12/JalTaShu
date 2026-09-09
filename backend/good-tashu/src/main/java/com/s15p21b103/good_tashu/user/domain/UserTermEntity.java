package com.s15p21b103.good_tashu.user.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
        name = "user_terms"
)
public class UserTermEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name="user_term_id")
    private Long userTermId;

    // 단일 PK를 사용하는 경우, JPA의 기본 조인 컬럼 이름은 다음 규칙으로 결정된다.
    // 연관관계 필드명 + "_" + 참조하는 테이블의 PK 컬럼명
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private UserEntity user;

    @Column(name = "term_code", nullable = false, length = 10)
    private String termCode;

    @Column(name="term_version", nullable = false, length = 10)
    @Setter
    private String termVersion;

    @Column(name="created_at")
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Builder
    public UserTermEntity(UserEntity user, String termCode, String termVersion) {
        this.user = user;
        this.termCode = termCode;
        this.termVersion = termVersion;
    }
}
