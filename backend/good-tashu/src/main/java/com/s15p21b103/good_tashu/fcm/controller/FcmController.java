package com.s15p21b103.good_tashu.fcm.controller;

import com.s15p21b103.good_tashu.fcm.dto.req.FcmTokenDeactivateRequest;
import com.s15p21b103.good_tashu.fcm.dto.req.FcmTokenRegisterRequest;
import com.s15p21b103.good_tashu.fcm.service.FcmService;
import com.s15p21b103.good_tashu._util.response.*;
import com.s15p21b103.good_tashu.user.annotation.currentUserId;
import com.s15p21b103.good_tashu.user.domain.SocialOAuth2User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/fcm")
@RequiredArgsConstructor
public class FcmController {
    private final FcmService fcmService;

    //토큰 등록
    @PostMapping("/tokens")
    public ApiResponse<Void> registerToken(
            @currentUserId Long userId,
            @Valid @RequestBody FcmTokenRegisterRequest request
    ) {
        fcmService.registerToken(userId, request);
        return ApiResponse.success("fcm 토큰이 등록되었습니다.");
    }

    //토큰 비활성화
    @DeleteMapping("/tokens")
    public ApiResponse<Void> deactivateToken(
            @currentUserId Long userId,
            @Valid @RequestBody FcmTokenDeactivateRequest request
    ) {
        fcmService.deactivateToken(userId, request);
        return ApiResponse.success("fcm 토큰이 비활성화되었습니다.");
    }
}
