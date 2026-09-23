package com.s15p21b103.good_tashu.notification.service;

import com.s15p21b103.good_tashu.notification.domain.NotificationEntity;
import com.s15p21b103.good_tashu.notification.domain.NotificationType;
import com.s15p21b103.good_tashu.notification.dto.res.NotificationResponse;
import com.s15p21b103.good_tashu.notification.repository.NotificationRepository;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.exception.UserException;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import static com.s15p21b103.good_tashu.user.exception.UserErrorCode.NOT_EXISTS_USER;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private static final DateTimeFormatter DATE_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<NotificationResponse> getMyNotifications(Long userId) {
        return notificationRepository
                .findAllByUserEntity_UserIdOrderByCreatedAtDescNotificationIdDesc(userId)
                .stream()
                .map(notification -> new NotificationResponse(
                        notification.getNotificationId(),
                        notification.getType(),
                        notification.getTitle(),
                        notification.getBody(),
                        notification.getCreatedAt()
                ))
                .toList();
    }

    @Transactional
    public void recordRentalStarted(Long userId, LocalDateTime rentalAt) {
        save(
                userId,
                NotificationType.RENTAL_STARTED,
                "대여가 시작되었습니다.",
                "대여 시작 시간은 " + formatDateTime(rentalAt) + "입니다."
        );
    }

    @Transactional
    public void recordReturnCompleted(Long userId, LocalDateTime returnAt) {
        save(
                userId,
                NotificationType.RETURN_COMPLETED,
                "반납이 완료되었습니다.",
                "반납 완료 시간은 " + formatDateTime(returnAt) + "입니다."
        );
    }

    private void save(Long userId, NotificationType type, String title, String body) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new UserException(NOT_EXISTS_USER));
        notificationRepository.save(NotificationEntity.builder()
                .userEntity(user)
                .type(type)
                .title(title)
                .body(body)
                .build());
    }

    private String formatDateTime(LocalDateTime dateTime) {
        return dateTime.format(DATE_TIME_FORMATTER);
    }
}
