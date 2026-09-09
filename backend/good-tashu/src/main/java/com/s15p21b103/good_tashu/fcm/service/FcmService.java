package com.s15p21b103.good_tashu.fcm.service;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.s15p21b103.good_tashu.fcm.domain.FcmTokenEntity;
import com.s15p21b103.good_tashu.fcm.dto.req.FcmMessageRequest;
import com.s15p21b103.good_tashu.fcm.dto.req.FcmTokenDeactivateRequest;
import com.s15p21b103.good_tashu.fcm.dto.req.FcmTokenRegisterRequest;
import com.s15p21b103.good_tashu.fcm.exception.FcmException;
import com.s15p21b103.good_tashu.fcm.repository.FcmTokenRepository;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.exception.UserException;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import static com.s15p21b103.good_tashu.fcm.exception.FcmErrorCode.*;
import static com.s15p21b103.good_tashu.user.exception.UserErrorCode.NOT_EXISTS_USER;

@Service
@RequiredArgsConstructor
public class FcmService {
    private final FcmTokenRepository fcmTokenRepository;
    private final UserRepository userRepository;
    @Transactional
    public void registerToken(Long userId, FcmTokenRegisterRequest request) {
        UserEntity userEntity = userRepository.findById(userId)
                .orElseThrow(() -> new UserException(NOT_EXISTS_USER));

        //기존 토큰 존재한다면 갱신, 없다면 생성
        fcmTokenRepository.findByToken(request.token())
                .ifPresentOrElse(FcmTokenEntity::reactivate,
                        () -> fcmTokenRepository.save(
                                FcmTokenEntity.builder()
                                        .token(request.token())
                                        .platform(request.platform())
                                        .deviceId(request.deviceId())
                                        .userEntity(userEntity)
                                        .enabled(true)
                                        .lastSeenAt(LocalDateTime.now())
                                        .build()
                        )
                );
    }
    @Transactional
    public void deactivateToken(Long userId, FcmTokenDeactivateRequest request) {
        UserEntity userEntity = userRepository.findById(userId)
                .orElseThrow(() -> new UserException(NOT_EXISTS_USER));

        FcmTokenEntity fcmToken = fcmTokenRepository.findByToken(request.token())
                .orElseThrow(() -> new FcmException(NOT_AVAILABLE_TOKEN));

        if(fcmToken.getUserEntity() != userEntity)
            throw new FcmException(TOKEN_DEACTIVATE_FORBIDDEN);

        fcmToken.deactivate();
    }

    //대여 시작 알림 발송
    public void sendRentalStartedNotification(Long userId, LocalDateTime currentTime) {
        //TODO: 토큰별로 에러 분리하기
        fcmTokenRepository.findAllByUserEntity_UserIdAndEnabledTrue(userId)
                .forEach(token->
                        sendToToken(new FcmMessageRequest(token.getToken()
                                , "대여가 시작되었습니다."
                                ,"대여 시작시간은"+formatDateTime(currentTime)+"입니다."))

                );
    }

    //대여 시작 알림 발송
    public void sendReturnNotification(Long userId, LocalDateTime currentTime) {
        //TODO: 토큰별로 에러 분리하기
        fcmTokenRepository.findAllByUserEntity_UserIdAndEnabledTrue(userId)
                .forEach(token->
                        sendToToken(new FcmMessageRequest(token.getToken()
                                , "대여가 완료되었습니다."
                                ,"대여 완료시간은"+formatDateTime(currentTime)+"입니다."))

                );
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

    private String formatDateTime(LocalDateTime localDateTime) {
        DateTimeFormatter formatter =
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

        return localDateTime.format(formatter);
    }
}
