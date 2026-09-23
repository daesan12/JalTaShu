package com.s15p21b103.good_tashu.notification.repository;

import com.s15p21b103.good_tashu.notification.domain.NotificationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<NotificationEntity, Long> {
    List<NotificationEntity> findAllByUserEntity_UserIdOrderByCreatedAtDescNotificationIdDesc(Long userId);
}
