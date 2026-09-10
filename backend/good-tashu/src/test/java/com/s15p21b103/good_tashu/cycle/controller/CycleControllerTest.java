package com.s15p21b103.good_tashu.cycle.controller;

import com.s15p21b103.good_tashu._util.exception.GlobalExceptionHandler;
import com.s15p21b103.good_tashu.cycle.domain.ClaimCategory;
import com.s15p21b103.good_tashu.cycle.domain.ClaimReportCategory;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleClaimRequest;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleClaimListResponse;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleClaimResponse;
import com.s15p21b103.good_tashu.cycle.exception.CycleException;
import com.s15p21b103.good_tashu.cycle.service.CycleService;
import com.s15p21b103.good_tashu.user.annotation.currentUserId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.time.LocalDateTime;
import java.util.List;

import static com.s15p21b103.good_tashu.cycle.exception.CycleErrorCode.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// 인증은 테스트 사용자 1번으로 대체한다. 보안 필터 자체를 검증하는 테스트는 아니다.
@ExtendWith(MockitoExtension.class)
class CycleControllerTest {
    @Mock CycleService cycleService;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        HandlerMethodArgumentResolver userResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(currentUserId.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer container,
                                          NativeWebRequest request, WebDataBinderFactory binderFactory) {
                return 1L;
            }
        };
        mvc = MockMvcBuilders.standaloneSetup(new CycleController(cycleService))
                .setCustomArgumentResolvers(userResolver)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void multipartClaimBindsAllFourFields() throws Exception {
        var photo = new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[]{1, 2});
        when(cycleService.claimCycle(eq(1L), any())).thenReturn(new CycleClaimResponse(10L));

        mvc.perform(multipart("/api/cycle/claim").file(photo)
                        .param("cycleId", "C1").param("claimCategory", "TIRE").param("content", "타이어 펑크"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.claimId").value(10));

        var captor = ArgumentCaptor.forClass(CycleClaimRequest.class);
        verify(cycleService).claimCycle(eq(1L), captor.capture());
        assertThat(captor.getValue().cycleId()).isEqualTo("C1");
        assertThat(captor.getValue().claimCategory()).isEqualTo(ClaimCategory.TIRE);
        assertThat(captor.getValue().content()).isEqualTo("타이어 펑크");
        assertThat(captor.getValue().file().getBytes()).containsExactly(1, 2);
    }

    @Test
    void multipartClaimAllowsMissingPhoto() throws Exception {
        when(cycleService.claimCycle(eq(1L), any())).thenReturn(new CycleClaimResponse(10L));
        mvc.perform(multipart("/api/cycle/claim")
                        .param("cycleId", "C1").param("claimCategory", "TIRE").param("content", "타이어 펑크"))
                .andExpect(status().isOk());
        var captor = ArgumentCaptor.forClass(CycleClaimRequest.class);
        verify(cycleService).claimCycle(eq(1L), captor.capture());
        assertThat(captor.getValue().file()).isNull();
    }

    @Test
    void missingClaimCategoryIsRejectedBeforeServiceCall() throws Exception {
        mvc.perform(multipart("/api/cycle/claim").param("cycleId", "C1").param("content", "내용"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
        verifyNoInteractions(cycleService);
    }

    @Test
    void listBindsCycleIdAndReturnsSpecifiedFields() throws Exception {
        when(cycleService.getCycleClaims("C1")).thenReturn(List.of(new CycleClaimListResponse(
                10L, "타슈이용자", ClaimCategory.TIRE, "타이어 펑크", LocalDateTime.of(2026, 9, 10, 10, 0))));
        mvc.perform(get("/api/cycle/list").param("cycleId", "C1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].claimId").value(10))
                .andExpect(jsonPath("$.data[0].nickname").value("타슈이용자"))
                .andExpect(jsonPath("$.data[0].claimCategory").value("TIRE"))
                .andExpect(jsonPath("$.data[0].content").value("타이어 펑크"))
                .andExpect(jsonPath("$.data[0].createdAt").exists());
    }

    @Test
    void blankCycleIdDomainErrorBecomes400() throws Exception {
        when(cycleService.getCycleClaims("")).thenThrow(new CycleException(CYCLE_ID_REQUIRED));
        mvc.perform(get("/api/cycle/list").param("cycleId", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(CYCLE_ID_REQUIRED.getMessage()));
    }

    @Test
    void reportBindsUserClaimIdAndJsonEnum() throws Exception {
        mvc.perform(post("/api/cycle/claims/10/reports")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"claimCategory\":\"ABUSE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("신고가 접수되었습니다."));
        verify(cycleService).reportCycleClaim(1L, 10L, ClaimReportCategory.ABUSE);
    }

    @Test
    void reportRejectsMissingCategory() throws Exception {
        mvc.perform(post("/api/cycle/claims/10/reports")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(cycleService);
    }

    @Test
    void reportForMissingClaimReturns404() throws Exception {
        doThrow(new CycleException(NOT_EXIST_CLAIM_ID)).when(cycleService)
                .reportCycleClaim(1L, 99L, ClaimReportCategory.ABUSE);
        mvc.perform(post("/api/cycle/claims/99/reports")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"claimCategory\":\"ABUSE\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }
}
