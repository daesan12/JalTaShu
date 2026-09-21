package com.s15p21b103.good_tashu.notice.controller;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.notice.dto.res.NoticeDetailResponse;
import com.s15p21b103.good_tashu.notice.dto.res.NoticeListResponse;
import com.s15p21b103.good_tashu.notice.dto.res.PopupListResponse;
import com.s15p21b103.good_tashu.notice.exception.NoticeException;
import com.s15p21b103.good_tashu.notice.service.NoticeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notice")
@RequiredArgsConstructor
public class NoticeController {
    private final NoticeService noticeService;

    @GetMapping("/pop-up")
    public ApiResponse<List<PopupListResponse>> getPopupList() {
        return ApiResponse.success(noticeService.getPopupList());
    }

    //공지 목록 조회
    @GetMapping("/list")
    public ApiResponse<List<NoticeListResponse>> getNoticeList() {
        List<NoticeListResponse> noticeList = noticeService.getNoticeList();
        return ApiResponse.success(noticeList);
    }

    //공지 상세 조회
    @GetMapping("/{noticeId}")
    public ApiResponse<NoticeDetailResponse> getNoticeDetail(
            @PathVariable(name = "noticeId") Long noticeId) {
        NoticeDetailResponse noticeDetail = noticeService.getNoticeDetail(noticeId);
        return ApiResponse.success(noticeDetail);
    }
}
