package com.s15p21b103.good_tashu.cycle.controller;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleRentalRequest;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleReturnRequest;
import com.s15p21b103.good_tashu.cycle.service.CycleService;
import com.s15p21b103.good_tashu.user.annotation.currentUserId;
import com.s15p21b103.good_tashu.user.domain.SocialOAuth2User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/cycle")
public class CycleController {
    private final CycleService cycleService;
    //대여 요청
    @PostMapping("/rental")
    public ApiResponse<LocalDateTime> rentalCycle(@currentUserId Long userId,
                                                  @Valid @RequestBody CycleRentalRequest request){
        LocalDateTime localDateTime = cycleService.rentalCycle(userId, request);
        return ApiResponse.success(localDateTime);
    }
    //반납 요청
    @PostMapping("/return")
    public ApiResponse<LocalDateTime> returnCycle(@currentUserId Long userId,
                                                  @Valid @RequestBody CycleReturnRequest request){
        LocalDateTime localDateTime = cycleService.returnCycle(userId, request);
        return ApiResponse.success(localDateTime);
    }
    //자전거 상태제보

    //자전거 제보리스트 조회
    //자전거 상태제보 신고
    //개인이용내역 전체 통계 조회
    //개인이용내역 리스트 조회
    //개인이용내역 상세 조회
}
