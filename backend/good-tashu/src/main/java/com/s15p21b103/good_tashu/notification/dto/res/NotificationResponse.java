package com.s15p21b103.good_tashu.notification.dto.res;

import com.s15p21b103.good_tashu.notification.domain.NotificationType;

import java.time.LocalDateTime;

public record NotificationResponse(
        Long notificationId,
        NotificationType type,
        String title,
        String body,
        LocalDateTime createdAt
) {
}
