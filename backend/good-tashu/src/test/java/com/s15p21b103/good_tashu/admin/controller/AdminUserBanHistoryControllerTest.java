package com.s15p21b103.good_tashu.admin.controller;

import com.s15p21b103.good_tashu._util.exception.GlobalExceptionHandler;
import com.s15p21b103.good_tashu.admin.annotation.CurrentAdminId;
import com.s15p21b103.good_tashu.admin.dto.res.AdminUserBanHistoryResponse;
import com.s15p21b103.good_tashu.admin.service.AdminUserService;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.time.LocalDateTime;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminUserBanHistoryControllerTest {
    @Test
    void getLatestBanHistoryReturnsSpecifiedFields() throws Exception {
        // 관리자 GET 경로와 단일 제재 기록 응답 필드를 확인한다.
        AdminUserService service = mock(AdminUserService.class);
        LocalDateTime start = LocalDateTime.of(2026, 9, 15, 10, 0);
        when(service.getUserBanHistory(7L)).thenReturn(new AdminUserBanHistoryResponse(
                12L, start, start.plusDays(7), 7, "장난성 제보", 3L));

        HandlerMethodArgumentResolver adminResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(CurrentAdminId.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer container,
                                          NativeWebRequest request, WebDataBinderFactory binderFactory) {
                return 3L;
            }
        };
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AdminController(service, null, null))
                .setCustomArgumentResolvers(adminResolver)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mvc.perform(get("/api/admin/user/7/ban"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.banRecordId").value(12))
                .andExpect(jsonPath("$.data.banStartedAt").value("2026-09-15T10:00:00"))
                .andExpect(jsonPath("$.data.banEndAt").value("2026-09-22T10:00:00"))
                .andExpect(jsonPath("$.data.period").value(7))
                .andExpect(jsonPath("$.data.comment").value("장난성 제보"))
                .andExpect(jsonPath("$.data.adminId").value(3));
        verify(service).getUserBanHistory(7L);
    }
}
