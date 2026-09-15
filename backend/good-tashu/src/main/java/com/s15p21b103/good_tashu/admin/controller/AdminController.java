package com.s15p21b103.good_tashu.admin.controller;

import com.s15p21b103.good_tashu.admin.dto.res.AdminUserListResponse;
import com.s15p21b103.good_tashu.admin.service.AdminUserService;
import com.s15p21b103.good_tashu.admin.annotation.currentAdminId;
import com.s15p21b103.good_tashu.admin.dto.req.UserBanRequest;
import jakarta.validation.Valid;
import com.s15p21b103.good_tashu._util.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminUserService adminUserService;

    //사용자 목록 조회
    @GetMapping("/user/list")
    public ApiResponse<List<AdminUserListResponse>> getUserList(
            @currentAdminId Long adminId,
            @RequestParam(defaultValue = "") String statement,
            @RequestParam(defaultValue = "newest") String order) {
        return ApiResponse.success(adminUserService.getUserList(statement, order));
    }
    //TODO: 경로 구현하고 구현
    //특정 사용자 상세조회

    //사용자 밴
    @PostMapping("/user/{userId}/ban")
    public ApiResponse<Void> banUser(@currentAdminId Long adminId,
                                     @PathVariable Long userId,
                                     @Valid @RequestBody UserBanRequest request) {
        adminUserService.banUser(adminId, userId, request);
        return ApiResponse.success("사용자 밴이 등록되었습니다.");
    }

    //사용자 밴 해제
    @PostMapping("/user/{userId}/un-ban")
    public ApiResponse<Void> unbanUser(@PathVariable Long userId) {
        adminUserService.releaseUserBan(userId);
        return ApiResponse.success("사용자 밴이 해제되었습니다.");
    }
}
