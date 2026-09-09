package com.s15p21b103.good_tashu.fcm.service;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.s15p21b103.good_tashu.fcm.domain.FcmTokenEntity;
import com.s15p21b103.good_tashu.fcm.dto.FcmMessageRequest;
import com.s15p21b103.good_tashu.fcm.dto.FcmTokenDeactivateRequest;
import com.s15p21b103.good_tashu.fcm.dto.FcmTokenRegisterRequest;
import com.s15p21b103.good_tashu.fcm.exception.FcmException;
import com.s15p21b103.good_tashu.fcm.repository.FcmTokenRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

import static com.s15p21b103.good_tashu.fcm.exception.FcmErrorCode.FAIL_TRANSFER_FCM_MESSAGE;
import static com.s15p21b103.good_tashu.fcm.exception.FcmErrorCode.NOT_AVAILABLE_TOKEN;

@Service
@RequiredArgsConstructor
public class FcmService {
    private final FcmTokenRepository fcmTokenRepository;

    @Transactional
    public void registerToken(FcmTokenRegisterRequest request) {
        //기존 토큰 존재한다면 갱신, 없다면 생성
        fcmTokenRepository.findByToken(request.token())
                .ifPresentOrElse(FcmTokenEntity::reactivate,
                        () -> fcmTokenRepository.save(
                                FcmTokenEntity.builder()
                                        .token(request.token())
                                        .platform(request.platform())
                                        .deviceId(request.deviceId())
                                        .enabled(true)
                                        .lastSeenAt(LocalDateTime.now())
                                        .build()
                        )
                );
    }
    @Transactional
    public void deactivateToken(FcmTokenDeactivateRequest request) {
        fcmTokenRepository.findByToken(request.token())
                .orElseThrow(() -> new FcmException(NOT_AVAILABLE_TOKEN))
                .deactivate();
    }

    //해당 토큰으로 메세지 전송
    public String sendToToken(FcmMessageRequest request) {
        FcmTokenEntity fcmTokenEntity = fcmTokenRepository.findByToken(request.token())
                .orElseThrow(() -> new FcmException(NOT_AVAILABLE_TOKEN));

        //활성여부 확인
        if(!Boolean.TRUE.equals(fcmTokenEntity.getEnabled())) {
            throw new FcmException(NOT_AVAILABLE_TOKEN);
        }
        Notification notification = Notification.builder()
                .setTitle(request.title())
                .setBody(request.body())
                .build();

        Message message = Message.builder()
                .setToken(fcmTokenEntity.getToken())
                .setNotification(notification)
                .build();

        try {
            return FirebaseMessaging.getInstance().send(message);
        } catch (FirebaseMessagingException e) {
            throw new FcmException(FAIL_TRANSFER_FCM_MESSAGE);
        }
    }
}
