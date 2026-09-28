package com.s15p21b103.good_tashu.notification.service;

import com.s15p21b103.good_tashu.notification.domain.NotificationEntity;
import com.s15p21b103.good_tashu.notification.domain.NotificationType;
import com.s15p21b103.good_tashu.notification.dto.res.NotificationResponse;
import com.s15p21b103.good_tashu.notification.repository.NotificationRepository;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {
    @Mock NotificationRepository notificationRepository;
    @Mock UserRepository userRepository;
    @InjectMocks NotificationService notificationService;

    @Test
    void returnsMyNotificationsInRepositoryOrder() {
        LocalDateTime newestAt = LocalDateTime.of(2026, 9, 23, 12, 0);
        LocalDateTime olderAt = newestAt.minusHours(1);
        when(notificationRepository
                .findAllByUserEntity_UserIdOrderByCreatedAtDescNotificationIdDesc(1L))
                .thenReturn(List.of(
                        notification(2L, NotificationType.RETURN_COMPLETED, "반납 완료", newestAt),
                        notification(1L, NotificationType.RENTAL_STARTED, "대여 시작", olderAt)
                ));

        assertThat(notificationService.getMyNotifications(1L)).containsExactly(
                new NotificationResponse(
                        2L, NotificationType.RETURN_COMPLETED, "반납 완료", "내용", newestAt),
                new NotificationResponse(
                        1L, NotificationType.RENTAL_STARTED, "대여 시작", "내용", olderAt)
        );
    }

    @Test
    void recordsRentalStartedNotification() {
        UserEntity user = UserEntity.builder().providerUserId("provider-user").build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        LocalDateTime rentalAt = LocalDateTime.of(2026, 9, 23, 9, 5);

        notificationService.recordRentalStarted(1L, rentalAt);

        ArgumentCaptor<NotificationEntity> captor = ArgumentCaptor.forClass(NotificationEntity.class);
        verify(notificationRepository).save(captor.capture());
        assertThat(captor.getValue().getUserEntity()).isSameAs(user);
        assertThat(captor.getValue().getType()).isEqualTo(NotificationType.RENTAL_STARTED);
        assertThat(captor.getValue().getTitle()).isEqualTo("대여가 시작되었습니다.");
        assertThat(captor.getValue().getBody()).isEqualTo("대여 시작 시간은 2026-09-23 09:05입니다.");
    }

    private NotificationEntity notification(
            Long id,
            NotificationType type,
            String title,
            LocalDateTime createdAt
    ) {
        return NotificationEntity.builder()
                .notificationId(id)
                .type(type)
                .title(title)
                .body("내용")
                .createdAt(createdAt)
                .build();
    }
}
