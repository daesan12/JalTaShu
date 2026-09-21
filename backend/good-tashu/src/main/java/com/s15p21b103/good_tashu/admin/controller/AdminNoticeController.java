package com.s15p21b103.good_tashu.admin.controller;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.admin.annotation.CurrentAdminId;
import com.s15p21b103.good_tashu.admin.dto.req.AdminNoticeCreateRequest;
import com.s15p21b103.good_tashu.admin.dto.req.AdminNoticeUpdateRequest;
import com.s15p21b103.good_tashu.admin.dto.res.AdminNoticeCreateResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminPopupCreateResponse;
import com.s15p21b103.good_tashu.admin.service.AdminNoticeService;
import com.s15p21b103.good_tashu.notice.dto.res.NoticeListResponse;
import com.s15p21b103.good_tashu.notice.service.NoticeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin")
public class AdminNoticeController {
    private final AdminNoticeService adminNoticeService;
    private final NoticeService noticeService;

    @GetMapping("/notice/list")
    public ApiResponse<List<NoticeListResponse>> getNoticeList(
            @CurrentAdminId Long adminId) {
        return ApiResponse.success(noticeService.getNoticeList());
    }

    @PostMapping("/notice")
    public ApiResponse<AdminNoticeCreateResponse> createNotice(
            @CurrentAdminId Long adminId,
            @Valid @RequestBody AdminNoticeCreateRequest request) {
        return ApiResponse.success(adminNoticeService.createNotice(adminId, request));
    }

    @PatchMapping("/notice/{noticeId}")
    public ApiResponse<AdminNoticeCreateResponse> updateNotice(
            @CurrentAdminId Long adminId,
            @PathVariable(name = "noticeId") Long noticeId,
            @RequestBody AdminNoticeUpdateRequest request) {
        return ApiResponse.success(adminNoticeService.updateNotice(noticeId, request));
    }

    @DeleteMapping("/notice/{noticeId}") 
    public ApiResponse<Void> deleteNotice(
            @CurrentAdminId Long adminId,
            @PathVariable(name = "noticeId") Long noticeId) {
        adminNoticeService.deleteNotice(noticeId);
        return ApiResponse.success("공지사항이 삭제되었습니다.");
    }

    @PostMapping(value = "/pop-up", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AdminPopupCreateResponse> createPopup(
            @CurrentAdminId Long adminId,
            @RequestParam(name = "title") String title,
            @RequestParam(name = "photo") MultipartFile photo,
            @RequestParam(name = "noticeId") Long noticeId) {
        return ApiResponse.success(adminNoticeService.createPopup(adminId, title, photo, noticeId));
    }

    @PatchMapping(value = "/pop-up/{popupId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AdminPopupCreateResponse> updatePopup(
            @CurrentAdminId Long adminId,
            @PathVariable(name = "popupId") Long popupId,
            @RequestParam(name = "title", required = false) String title,
            @RequestParam(name = "photo", required = false) MultipartFile photo,
            @RequestParam(name = "noticeId", required = false) Long noticeId) {
        return ApiResponse.success(adminNoticeService.updatePopup(popupId, title, photo, noticeId));
    }

    @DeleteMapping("/pop-up/{popupId}")
    public ApiResponse<Void> deletePopup(
            @CurrentAdminId Long adminId,
            @PathVariable(name = "popupId") Long popUpId) {
        adminNoticeService.deletePopup(popUpId);
        return ApiResponse.success("팝업이 삭제되었습니다.");
    }
}
