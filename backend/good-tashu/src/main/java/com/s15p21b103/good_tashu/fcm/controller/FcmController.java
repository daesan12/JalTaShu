package com.s15p21b103.good_tashu.fcm.controller;

import com.s15p21b103.good_tashu.fcm.dto.FcmTokenDeactivateRequest;
import com.s15p21b103.good_tashu.fcm.dto.FcmTokenRegisterRequest;
import com.s15p21b103.good_tashu.fcm.service.FcmService;
import com.s15p21b103.good_tashu._util.response.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/fcm")
@RequiredArgsConstructor
public class FcmController {
    private final FcmService fcmService;

    //토큰 등록
    @PostMapping("/tokens")
    public ApiResponse<Void> registerToken(
            @Valid @RequestBody FcmTokenRegisterRequest request
    ) {
        fcmService.registerToken(request);
        return ApiResponse.success("fcm 토큰이 등록되었습니다.");
    }

    //토큰 비활성화
    @DeleteMapping("/tokens")
    public ApiResponse<Void> deactivateToken(
            @Valid @RequestBody FcmTokenDeactivateRequest request
    ) {
        fcmService.deactivateToken(request);
        return ApiResponse.success("fcm 토큰이 비활성화되었습니다.");
    }
}
