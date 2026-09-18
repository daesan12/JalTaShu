package com.s15p21b103.good_tashu.user.controller;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.user.annotation.CurrentUserId;
import com.s15p21b103.good_tashu.user.dto.req.UserNicknameRequestDto;
import com.s15p21b103.good_tashu.user.dto.res.UserMeResponse;
import com.s15p21b103.good_tashu.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;
    
    // 현재 사용자 정보 획득
    @GetMapping("/me")
    public ApiResponse<UserMeResponse> getMyInfo(@CurrentUserId Long userId) {
        return ApiResponse.success(userService.getMyInfo(userId));
    }

    // 사용자 정보 수정
    // 현재는 닉네임만
    @PatchMapping("/me")
    public ApiResponse<Void> PatchMyInfo(
            @CurrentUserId Long userId,
            @Valid @RequestBody UserNicknameRequestDto requestDto
            ) {
        userService.updateNickname(userId, requestDto);
        return ApiResponse.success("닉네임 변경이 완료되었습니다.");
    }
}
