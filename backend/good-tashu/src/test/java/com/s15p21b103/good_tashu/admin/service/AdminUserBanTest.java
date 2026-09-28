package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu.admin.domain.AdminEntity;
import com.s15p21b103.good_tashu.admin.domain.UserBanRecordEntity;
import com.s15p21b103.good_tashu.admin.dto.req.UserBanRequest;
import com.s15p21b103.good_tashu.admin.exception.AdminException;
import com.s15p21b103.good_tashu.admin.repository.AdminRepository;
import com.s15p21b103.good_tashu.admin.repository.UserBanRecordRepository;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.Optional;

import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.ALREADY_BANNED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminUserBanTest {
    @Test
    void duplicateCheckUsesLatestActiveBanQuery() {
        AdminRepository adminRepository = mock(AdminRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        UserBanRecordRepository banRecordRepository = mock(UserBanRecordRepository.class);
        AdminEntity admin = mock(AdminEntity.class);
        UserEntity user = mock(UserEntity.class);
        UserBanRecordEntity activeBan = mock(UserBanRecordEntity.class);
        when(adminRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(banRecordRepository.findLatestActiveBan(eq(7L), any(LocalDateTime.class)))
                .thenReturn(Optional.of(activeBan));
        AdminUserService service = new AdminUserService(
                null, adminRepository, userRepository, banRecordRepository, null, null, null);

        LocalDateTime before = LocalDateTime.now();
        assertThatThrownBy(() -> service.banUser(
                1L, 7L, new UserBanRequest(LocalDateTime.now().plusDays(7), "test")))
                .isInstanceOfSatisfying(AdminException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ALREADY_BANNED));
        LocalDateTime after = LocalDateTime.now();

        ArgumentCaptor<LocalDateTime> nowCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(banRecordRepository).findLatestActiveBan(eq(7L), nowCaptor.capture());
        assertThat(nowCaptor.getValue()).isBetween(before, after);
    }
}
