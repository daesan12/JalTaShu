package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu.admin.domain.AdminEntity;
import com.s15p21b103.good_tashu.admin.domain.UserBanRecordEntity;
import com.s15p21b103.good_tashu.admin.dto.res.AdminUserBanHistoryResponse;
import com.s15p21b103.good_tashu.admin.exception.AdminException;
import com.s15p21b103.good_tashu.admin.repository.UserBanRecordRepository;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.NOT_EXISTS_BAN_RECORD;
import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.NOT_EXISTS_USER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminUserBanHistoryTest {
    @Mock UserRepository userRepository;
    @Mock UserBanRecordRepository banRecordRepository;
    @Mock UserBanRecordEntity ban;
    @Mock AdminEntity admin;

    private AdminUserService service;

    @BeforeEach
    void setUp() {
        service = new AdminUserService(null, null, userRepository, banRecordRepository, null);
    }

    @Test
    void latestBanReturnsScheduledEndAndOriginalPeriod() {
        // 아직 해제되지 않은 기록은 예정 종료 시각과 예정 제재 일수를 반환한다.
        LocalDateTime start = LocalDateTime.of(2026, 9, 15, 10, 0);
        LocalDateTime scheduledEnd = start.plusDays(7);
        when(userRepository.existsById(7L)).thenReturn(true);
        when(banRecordRepository.findFirstByUser_UserIdOrderByStartedAtDescIdDesc(7L))
                .thenReturn(Optional.of(ban));
        when(ban.getStartedAt()).thenReturn(start);
        when(ban.getId()).thenReturn(12L);
        when(ban.getScheduledEndAt()).thenReturn(scheduledEnd);
        when(ban.getComment()).thenReturn("장난성 제보");
        when(ban.getAdmin()).thenReturn(admin);
        when(admin.getAdminId()).thenReturn(3L);

        AdminUserBanHistoryResponse response = service.getUserBanHistory(7L);

        assertThat(response.banRecordId()).isEqualTo(12L);
        assertThat(response.banStartedAt()).isEqualTo(start);
        assertThat(response.banEndAt()).isEqualTo(scheduledEnd);
        assertThat(response.period()).isEqualTo(7);
        assertThat(response.comment()).isEqualTo("장난성 제보");
        assertThat(response.adminId()).isEqualTo(3L);
    }

    @Test
    void releasedBanReturnsActualEndButKeepsOriginalPeriod() {
        // 조기 해제 시 실제 해제 시각을 반환하되, period는 최초 예정 기간을 유지한다.
        LocalDateTime start = LocalDateTime.of(2026, 9, 15, 10, 0);
        LocalDateTime released = start.plusDays(2);
        when(userRepository.existsById(7L)).thenReturn(true);
        when(banRecordRepository.findFirstByUser_UserIdOrderByStartedAtDescIdDesc(7L))
                .thenReturn(Optional.of(ban));
        when(ban.getStartedAt()).thenReturn(start);
        when(ban.getScheduledEndAt()).thenReturn(start.plusDays(7));
        when(ban.getReleasedAt()).thenReturn(released);
        when(ban.getAdmin()).thenReturn(admin);
        when(admin.getAdminId()).thenReturn(3L);

        AdminUserBanHistoryResponse response = service.getUserBanHistory(7L);

        assertThat(response.banEndAt()).isEqualTo(released);
        assertThat(response.period()).isEqualTo(7);
    }

    @Test
    void unknownUserReturnsNotFound() {
        // 존재하지 않는 사용자는 제재 기록 조회 없이 404 오류가 된다.
        assertThatThrownBy(() -> service.getUserBanHistory(7L))
                .isInstanceOfSatisfying(AdminException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(NOT_EXISTS_USER));
        verifyNoInteractions(banRecordRepository);
    }

    @Test
    void userWithoutBanReturnsNotFound() {
        // 사용자는 있으나 제재 이력이 없다면 별도 404 오류를 반환한다.
        when(userRepository.existsById(7L)).thenReturn(true);
        assertThatThrownBy(() -> service.getUserBanHistory(7L))
                .isInstanceOfSatisfying(AdminException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(NOT_EXISTS_BAN_RECORD));
    }
}
