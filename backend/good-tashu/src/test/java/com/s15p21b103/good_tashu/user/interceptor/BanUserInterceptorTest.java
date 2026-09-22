package com.s15p21b103.good_tashu.user.interceptor;

import com.s15p21b103.good_tashu._util.exception.GlobalExceptionHandler;
import com.s15p21b103.good_tashu.admin.repository.UserBanRecordRepository;
import com.s15p21b103.good_tashu.admin.domain.UserBanRecordEntity;
import com.s15p21b103.good_tashu.cycle.controller.CycleController;
import com.s15p21b103.good_tashu.claim.dto.res.ClaimResponse;
import com.s15p21b103.good_tashu.cycle.service.CycleService;
import com.s15p21b103.good_tashu.claim.service.ClaimService;
import com.s15p21b103.good_tashu.claim.controller.ClaimController;
import com.s15p21b103.good_tashu.user.annotation.CurrentUserId;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.s15p21b103.good_tashu.user.exception.UserErrorCode.BANNED_USER;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class BanUserInterceptorTest {
    @Mock UserBanRecordRepository userBanRecordRepository;
    @Mock UserBanRecordEntity banRecord;
    @Mock CycleService cycleService;
    @Mock ClaimService claimService;

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

        mvc = MockMvcBuilders.standaloneSetup(new CycleController(cycleService), new ClaimController(claimService))
                .addInterceptors(new BanUserInterceptor(userBanRecordRepository))
                .setCustomArgumentResolvers(userResolver)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        Jwt jwt = new Jwt("test-token", Instant.now(), Instant.now().plusSeconds(3600),
                Map.of("alg", "HS256"), Map.of("sub", "1"));
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void bannedUserCannotCreateClaim() throws Exception {
        // 제재 중이면 컨트롤러 호출 전에 403으로 차단한다.
        when(userBanRecordRepository
                .findLatestActiveBan(eq(1L), any(LocalDateTime.class)))
                .thenReturn(Optional.of(banRecord));
        when(banRecord.getComment()).thenReturn("장난성 제보를 반복했습니다.");

        mvc.perform(multipart("/api/claim/cycle")
                        .param("cycleId", "C1")
                        .param("claimCategory", "TIRE")
                        .param("content", "타이어 펑크"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("장난성 제보를 반복했습니다."));

        verify(userBanRecordRepository)
                .findLatestActiveBan(eq(1L), any(LocalDateTime.class));
        verifyNoInteractions(cycleService, claimService);
    }

    @Test
    void blankBanReasonUsesDefaultMessage() throws Exception {
        // 관리자 메모가 공백이면 기존 제재 오류 문구를 반환한다.
        when(userBanRecordRepository
                .findLatestActiveBan(eq(1L), any(LocalDateTime.class)))
                .thenReturn(Optional.of(banRecord));
        when(banRecord.getComment()).thenReturn("   ");

        mvc.perform(multipart("/api/claim/cycle")
                        .param("cycleId", "C1")
                        .param("claimCategory", "TIRE")
                        .param("content", "타이어 펑크"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(BANNED_USER.getMessage()));
        verifyNoInteractions(cycleService, claimService);
    }

    @Test
    void nullBanReasonStillBlocksWithDefaultMessage() throws Exception {
        // 메모가 null인 제재 기록도 차단하고 기본 문구를 반환한다.
        when(userBanRecordRepository
                .findLatestActiveBan(eq(1L), any(LocalDateTime.class)))
                .thenReturn(Optional.of(banRecord));

        mvc.perform(multipart("/api/claim/cycle")
                        .param("cycleId", "C1")
                        .param("claimCategory", "TIRE")
                        .param("content", "타이어 펑크"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(BANNED_USER.getMessage()));
        verifyNoInteractions(cycleService, claimService);
    }

    @Test
    void normalUserCanCreateClaim() throws Exception {
        // 제재 기록이 없으면 제보 서비스까지 요청이 전달된다.
        when(userBanRecordRepository
                .findLatestActiveBan(eq(1L), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());
        when(claimService.claimCycle(eq(1L), any())).thenReturn(new ClaimResponse(10L));

        mvc.perform(multipart("/api/claim/cycle")
                        .param("cycleId", "C1")
                        .param("claimCategory", "TIRE")
                        .param("content", "타이어 펑크"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.claimId").value(10));

        verify(claimService).claimCycle(eq(1L), any());
    }

    @Test
    void unmarkedEndpointDoesNotCheckBan() throws Exception {
        // @BlockBanUser가 없는 목록 조회는 제재 여부를 조회하지 않는다.
        when(claimService.getCycleClaims("C1")).thenReturn(List.of());

        mvc.perform(get("/api/claim/list").param("cycleId", "C1"))
                .andExpect(status().isOk());

        verifyNoInteractions(userBanRecordRepository);
    }
}
