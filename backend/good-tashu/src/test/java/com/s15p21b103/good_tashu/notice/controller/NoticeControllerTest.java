package com.s15p21b103.good_tashu.notice.controller;

import com.s15p21b103.good_tashu._util.exception.GlobalExceptionHandler;
import com.s15p21b103.good_tashu.notice.dto.res.NoticeDetailResponse;
import com.s15p21b103.good_tashu.notice.dto.res.NoticeListResponse;
import com.s15p21b103.good_tashu.notice.exception.NoticeException;
import com.s15p21b103.good_tashu.notice.service.NoticeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;

import static com.s15p21b103.good_tashu.notice.exception.NoticeErrorCode.NOT_EXIST_NOTICE_ID;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// standalone 테스트: DB와 로그인/CSRF 필터 없이 MVC 매핑 및 응답만 검증한다.
@ExtendWith(MockitoExtension.class)
class NoticeControllerTest {
    @Mock NoticeService noticeService;
    private MockMvc mvc;
    private final LocalDateTime createdAt = LocalDateTime.of(2026, 9, 10, 10, 0);

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new NoticeController(noticeService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listReturnsArrayWithSpecifiedFields() throws Exception {
        when(noticeService.getNoticeList()).thenReturn(List.of(
                new NoticeListResponse(1L, "공지 제목", "admin01", createdAt)));

        mvc.perform(get("/api/notice/list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].noticeId").value(1))
                .andExpect(jsonPath("$.data[0].title").value("공지 제목"))
                .andExpect(jsonPath("$.data[0].author").value("admin01"))
                .andExpect(jsonPath("$.data[0].createdAt").exists())
                .andExpect(jsonPath("$.data[0].content").doesNotExist())
                .andExpect(jsonPath("$.data[0].password").doesNotExist());
    }

    @Test
    void emptyListIsAnArrayInsteadOfNull() throws Exception {
        when(noticeService.getNoticeList()).thenReturn(List.of());
        mvc.perform(get("/api/notice/list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    void detailBindsIdAndIncludesContent() throws Exception {
        when(noticeService.getNoticeDetail(7L)).thenReturn(
                new NoticeDetailResponse("공지 제목", "admin01", createdAt, "공지 내용"));

        mvc.perform(get("/api/notice/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("공지 제목"))
                .andExpect(jsonPath("$.data.author").value("admin01"))
                .andExpect(jsonPath("$.data.createdAt").exists())
                .andExpect(jsonPath("$.data.content").value("공지 내용"))
                .andExpect(jsonPath("$.data.password").doesNotExist());
        verify(noticeService).getNoticeDetail(7L);
    }

    @Test
    void missingNoticeIsReturnedAs404() throws Exception {
        when(noticeService.getNoticeDetail(99L)).thenThrow(new NoticeException(NOT_EXIST_NOTICE_ID));
        mvc.perform(get("/api/notice/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value(NOT_EXIST_NOTICE_ID.getMessage()));
    }
}
