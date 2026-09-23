package com.s15p21b103.good_tashu.notification.controller;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.notification.dto.res.NotificationResponse;
import com.s15p21b103.good_tashu.notification.service.NotificationService;
import com.s15p21b103.good_tashu.user.annotation.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    @GetMapping
    public ApiResponse<List<NotificationResponse>> getMyNotifications(@CurrentUserId Long userId) {
        return ApiResponse.success(notificationService.getMyNotifications(userId));
    }
}
