package com.s15p21b103.good_tashu.admin.controller;

import com.s15p21b103.good_tashu.admin.service.AdminNoticeService;
import com.s15p21b103.good_tashu.notice.dto.res.PopupListResponse;
import com.s15p21b103.good_tashu.notice.service.NoticeService;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminNoticeControllerTest {

    @Test
    void popupListReturnsPopupIdAndPhotoUrl() throws Exception {
        AdminNoticeService adminNoticeService = mock(AdminNoticeService.class);
        NoticeService noticeService = mock(NoticeService.class);
        when(noticeService.getPopupList()).thenReturn(List.of(
                new PopupListResponse(3L, "팝업 제목", "https://example.com/signed-photo", 7L)));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(
                new AdminNoticeController(adminNoticeService, noticeService)).build();

        mvc.perform(get("/api/admin/pop-up"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].popupId").value(3))
                .andExpect(jsonPath("$.data[0].title").value("팝업 제목"))
                .andExpect(jsonPath("$.data[0].photoUrl").value("https://example.com/signed-photo"))
                .andExpect(jsonPath("$.data[0].noticeId").value(7));
    }
}
