package com.s15p21b103.good_tashu.cycle.controller;

import com.s15p21b103.good_tashu._util.exception.GlobalExceptionHandler;
import com.s15p21b103.good_tashu.cycle.domain.ClaimCategory;
import com.s15p21b103.good_tashu.cycle.domain.ClaimReportCategory;
import com.s15p21b103.good_tashu.cycle.dto.req.CycleClaimRequest;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleClaimListResponse;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleClaimResponse;
import com.s15p21b103.good_tashu.cycle.dto.res.CyclePointResponse;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleStatisticsResponse;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleUsageDetailResponse;
import com.s15p21b103.good_tashu.cycle.dto.res.CycleUsageListResponse;
import com.s15p21b103.good_tashu.cycle.exception.CycleException;
import com.s15p21b103.good_tashu.cycle.service.CycleService;
import com.s15p21b103.good_tashu.path.domain.PathInfo;
import com.s15p21b103.good_tashu.user.annotation.CurrentUserId;
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
import java.math.BigDecimal;
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
                return parameter.hasParameterAnnotation(CurrentUserId.class);
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
        MockMultipartFile photo = new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[]{1, 2});
        when(cycleService.claimCycle(eq(1L), any())).thenReturn(new CycleClaimResponse(10L));

        mvc.perform(multipart("/api/cycle/claim").file(photo)
                        .param("usageId", "100").param("claimCategory", "TIRE").param("content", "타이어 펑크"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.claimId").value(10));

        ArgumentCaptor<CycleClaimRequest> captor = ArgumentCaptor.forClass(CycleClaimRequest.class);
        verify(cycleService).claimCycle(eq(1L), captor.capture());
        assertThat(captor.getValue().usageId()).isEqualTo(100L);
        assertThat(captor.getValue().claimCategory()).isEqualTo(ClaimCategory.TIRE);
        assertThat(captor.getValue().content()).isEqualTo("타이어 펑크");
        assertThat(captor.getValue().file().getBytes()).containsExactly(1, 2);
    }

    @Test
    void multipartClaimAllowsMissingPhoto() throws Exception {
        when(cycleService.claimCycle(eq(1L), any())).thenReturn(new CycleClaimResponse(10L));
        mvc.perform(multipart("/api/cycle/claim")
                        .param("usageId", "100").param("claimCategory", "TIRE").param("content", "타이어 펑크"))
                .andExpect(status().isOk());
        ArgumentCaptor<CycleClaimRequest> captor = ArgumentCaptor.forClass(CycleClaimRequest.class);
        verify(cycleService).claimCycle(eq(1L), captor.capture());
        assertThat(captor.getValue().file()).isNull();
    }

    @Test
    void missingClaimCategoryIsRejectedBeforeServiceCall() throws Exception {
        mvc.perform(multipart("/api/cycle/claim").param("usageId", "100").param("content", "내용"))
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

    @Test
    void statisticsEndpointPassesAuthenticatedUserAndReturnsStatistics() throws Exception {
        // 로그인 사용자의 전체 이용 통계를 서비스 응답으로 전달하는지 확인한다.
        when(cycleService.getStatistics(1L))
                .thenReturn(new CycleStatisticsResponse(3L, 12000L, 3600L));

        mvc.perform(get("/api/cycle/statics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalUseCnt").value(3))
                .andExpect(jsonPath("$.data.totalDistance").value(12000))
                .andExpect(jsonPath("$.data.totalCycleRidingTime").value(3600));

        verify(cycleService).getStatistics(1L);
    }

    @Test
    void usageListEndpointReturnsUsageList() throws Exception {
        // 이용내역 목록 조회 시 서비스 결과와 사용자 ID 전달을 확인한다.
        LocalDateTime startingDate = LocalDateTime.of(2026, 9, 15, 10, 0);
        CyclePointResponse startingPoint = new CyclePointResponse(new BigDecimal("36.350400"), new BigDecimal("127.384500"));
        CyclePointResponse endPoint = new CyclePointResponse(new BigDecimal("36.351000"), new BigDecimal("127.385200"));
        when(cycleService.getUsageList(1L)).thenReturn(List.of(
                new CycleUsageListResponse(12L, startingPoint, endPoint, startingDate, 600, "C1")));

        mvc.perform(get("/api/cycle/usage/list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].usageId").value(12))
                .andExpect(jsonPath("$.data[0].cycleId").value("C1"))
                .andExpect(jsonPath("$.data[0].totalDuration").value(600))
                .andExpect(jsonPath("$.data[0].startingPoint.latitude").value(36.3504))
                .andExpect(jsonPath("$.data[0].endPoint.longitude").value(127.3852));

        verify(cycleService).getUsageList(1L);
    }

    @Test
    void usageDetailEndpointReturnsDetailedUsage() throws Exception {
        // 이용내역 상세 조회 결과의 경로·거리·평균속도 필드가 JSON으로 반환되는지 확인한다.
        LocalDateTime startingDate = LocalDateTime.of(2026, 9, 15, 10, 0);
        PathInfo pathInfo = new PathInfo(List.of(new PathInfo.PathPoint(
                new BigDecimal("36.350400"), new BigDecimal("127.384500"),
                new BigDecimal("52.3"), com.s15p21b103.good_tashu.map.domain.TravelStatus.BIKE, 1)));
        CycleUsageDetailResponse response = new CycleUsageDetailResponse(
                600, 3000,
                new CyclePointResponse(new BigDecimal("36.350400"), new BigDecimal("127.384500")),
                new CyclePointResponse(new BigDecimal("36.351000"), new BigDecimal("127.385200")),
                startingDate, "C1", new BigDecimal("18.00"), pathInfo,
                startingDate, startingDate.plusSeconds(600));
        when(cycleService.getUsageDetail(1L, 12L)).thenReturn(response);

        mvc.perform(get("/api/cycle/usage/12"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalDuration").value(600))
                .andExpect(jsonPath("$.data.totalDistance").value(3000))
                .andExpect(jsonPath("$.data.averageCycleRidingSpeed").value(18.0))
                .andExpect(jsonPath("$.data.pathInfo.road[0].travelStatus").value("BIKE"))
                .andExpect(jsonPath("$.data.pathInfo.road[0].seq").value(1));

        verify(cycleService).getUsageDetail(1L, 12L);
    }
}
