package com.s15p21b103.good_tashu.user.controller;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.user.annotation.CurrentUserId;
import com.s15p21b103.good_tashu.user.dto.res.UserMeResponse;
import com.s15p21b103.good_tashu.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;

    @GetMapping("/me")
    public ApiResponse<UserMeResponse> getMyInfo(@CurrentUserId Long userId) {
        return ApiResponse.success(userService.getMyInfo(userId));
    }
}
