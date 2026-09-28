package com.s15p21b103.good_tashu.fcm.listener;

import com.s15p21b103.good_tashu.cycle.event.CycleRentalStartedEvent;
import com.s15p21b103.good_tashu.cycle.event.CycleReturnEvent;
import com.s15p21b103.good_tashu.fcm.service.FcmService;
import com.s15p21b103.good_tashu.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class CycleFcmListener {
    private final FcmService fcmService;
    private final NotificationService notificationService;

    @Async
    @TransactionalEventListener(
            phase = TransactionPhase.AFTER_COMMIT
    )
    public void handle(CycleRentalStartedEvent event) {
        try {
            notificationService.recordRentalStarted(event.userId(), event.rentalAt());
            fcmService.sendRentalStartedNotification(event.userId(), event.rentalAt());
        } catch (Exception e) {
            log.warn("{}의 대여 완료 알림 발송에 실패하였습니다., {}", event.userId(), e);
        }
    }

    @Async
    @TransactionalEventListener(
            phase = TransactionPhase.AFTER_COMMIT
    )
    public void handle(CycleReturnEvent event) {
        try {
            notificationService.recordReturnCompleted(event.userId(), event.returnAt());
            fcmService.sendReturnNotification(event.userId(), event.returnAt());
        } catch (Exception e) {
            log.warn("{}의 반납 완료 알림 발송에 실패하였습니다., {}", event.userId(), e);
        }
    }
}
