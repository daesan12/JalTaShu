package com.s15p21b103.good_tashu._util.outbox.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "outbox_events")
public class OutboxEventEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name="outbox_event_id")
    private Long outboxEventId;

    @Enumerated(EnumType.STRING)
    @Column(name="event_type", nullable = false, length = 20)
    private OutboxEventType eventType;

    @Column(name = "aggregate_id", nullable = false)
    private String aggregateId;

    // Hibernate가 해당 필드를 JSON 타입으로 읽고 쓰도록 지정.
    @JdbcTypeCode(SqlTypes.JSON)
    // MySQL JSON 컬럼으로 선언
    @Column(name="payload", nullable = true, columnDefinition = "json")
    private String payload;

    @Column(name="created_at")
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name="attempt_count")
    private int attemptCount;

    @Builder
    public OutboxEventEntity(OutboxEventType eventType, String aggregateId, String payload) {
        this.eventType = eventType;
        this.aggregateId = aggregateId;
        this.payload = payload;
        this.attemptCount = 0;
    }

    public void scheduleRetry() {
        this.attemptCount++;
    }
}
