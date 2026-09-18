package com.s15p21b103.good_tashu.user.service;

import com.s15p21b103.good_tashu._util.jwt.refresh_token.service.RefreshTokenService;
import com.s15p21b103.good_tashu.cycle.repository.CycleUsageRepository;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.dto.res.UserMeResponse;
import com.s15p21b103.good_tashu.user.exception.UserErrorCode;
import com.s15p21b103.good_tashu.user.exception.UserException;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import com.s15p21b103.good_tashu.user.repository.UserTermRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

@ExtendWith(MockitoExtension.class)
class UserMyInfoServiceTest {
    @Mock UserRepository userRepository;
    @Mock UserTermRepository userTermRepository;
    @Mock RefreshTokenService refreshTokenService;
    @Mock CycleUsageRepository cycleUsageRepository;
    @Mock CycleUsageRepository.MonthlyMoveStatistics statistics;
    @InjectMocks UserService userService;

    @Test
    void returnsCurrentMonthStatisticsInKilometersAndMinutes() {
        // 이번 달 완료 이용을 합산하고 화면용 km·분 단위로 변환한다.
        when(userRepository.findById(1L)).thenReturn(Optional.of(UserEntity.builder().nickname("타슈러버").build()));
        when(cycleUsageRepository.getMonthlyMoveStatistics(any(), any(), any())).thenReturn(statistics);
        when(statistics.getMonthlyMoveCnt()).thenReturn(12L);
        when(statistics.getMonthlyMoveDisMeters()).thenReturn(38200L);
        when(statistics.getMonthlyTimeSeconds()).thenReturn(5040L);

        UserMeResponse result = userService.getMyInfo(1L);

        assertThat(result.nickname()).isEqualTo("타슈러버");
        assertThat(result.monthlyMoveCnt()).isEqualTo(12L);
        assertThat(result.monthlyMoveDis()).isEqualByComparingTo("38.2");
        assertThat(result.monthlyTime()).isEqualTo(84L);

        ArgumentCaptor<LocalDateTime> from = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> to = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(cycleUsageRepository).getMonthlyMoveStatistics(org.mockito.ArgumentMatchers.eq(1L),
                from.capture(), to.capture());
        LocalDate firstDay = LocalDate.now(ZoneId.of("Asia/Seoul")).withDayOfMonth(1);
        assertThat(from.getValue()).isEqualTo(firstDay.atStartOfDay());
        assertThat(to.getValue()).isEqualTo(firstDay.plusMonths(1).atStartOfDay());
    }

    @Test
    void returnsNullDistanceWhenACompletedRideHasNoPathDistance() {
        // 일부 이동 거리 미수집 상태는 0km로 오인하지 않도록 null로 남긴다.
        when(userRepository.findById(1L)).thenReturn(Optional.of(UserEntity.builder().nickname("사용자").build()));
        when(cycleUsageRepository.getMonthlyMoveStatistics(any(), any(), any())).thenReturn(statistics);
        when(statistics.getMonthlyMoveCnt()).thenReturn(2L);
        when(statistics.getMonthlyMoveDisMeters()).thenReturn(null);
        when(statistics.getMonthlyTimeSeconds()).thenReturn(600L);

        UserMeResponse result = userService.getMyInfo(1L);

        assertThat(result.monthlyMoveDis()).isNull();
        assertThat(result.monthlyTime()).isEqualTo(10L);
    }

    @Test
    void returnsZerosWhenThereAreNoCompletedRides() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(UserEntity.builder().nickname("사용자").build()));
        when(cycleUsageRepository.getMonthlyMoveStatistics(any(), any(), any())).thenReturn(statistics);
        when(statistics.getMonthlyMoveCnt()).thenReturn(0L);
        when(statistics.getMonthlyMoveDisMeters()).thenReturn(0L);
        when(statistics.getMonthlyTimeSeconds()).thenReturn(0L);

        UserMeResponse result = userService.getMyInfo(1L);

        assertThat(result.monthlyMoveCnt()).isZero();
        assertThat(result.monthlyMoveDis()).isEqualByComparingTo("0.0");
        assertThat(result.monthlyTime()).isZero();
    }

    @Test
    void missingUserReturnsNotFoundBeforeQueryingUsage() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getMyInfo(99L))
                .isInstanceOfSatisfying(UserException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(UserErrorCode.NOT_EXISTS_USER));
        verify(cycleUsageRepository, never()).getMonthlyMoveStatistics(any(), any(), any());
    }
}
