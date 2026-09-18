package com.s15p21b103.good_tashu.admin.domain;

import com.s15p21b103.good_tashu.notice.domain.NoticeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "pop_ups")
public class PopupEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "pop_up_id")
    private Long popUpId;

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "photo_url", length = 255)
    private String photoUrl;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "notice_id", nullable = false)
    private NoticeEntity notice;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "admin_id", nullable = false)
    private AdminEntity admin;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public PopupEntity(String title, String photoUrl, NoticeEntity notice, AdminEntity admin) {
        this.title = title;
        this.photoUrl = photoUrl;
        this.notice = notice;
        this.admin = admin;
    }

    public void updateTitle(String title) {
        this.title = title;
    }

    public void updatePhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public void updateNotice(NoticeEntity notice) {
        this.notice = notice;
    }
}
