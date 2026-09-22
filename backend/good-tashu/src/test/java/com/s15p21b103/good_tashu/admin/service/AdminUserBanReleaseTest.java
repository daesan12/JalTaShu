package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu.admin.exception.AdminException;
import com.s15p21b103.good_tashu.admin.repository.UserBanRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.NOT_ACTIVE_BAN_RECORD;
import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.NOT_EXISTS_BAN_RECORD;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminUserBanReleaseTest {
    @Mock UserBanRecordRepository banRecordRepository;

    private AdminUserService service;

    @BeforeEach
    void setUp() {
        service = new AdminUserService(null, null, null, banRecordRepository, null, null, null);
    }

    @Test
    void releasesOnlyTheSelectedActiveRecord() {
        // 업데이트 대상은 사용자 ID가 아닌 제재 기록 ID다.
        when(banRecordRepository.releaseActiveBan(eq(12L), any(LocalDateTime.class)))
                .thenReturn(1);

        service.releaseUserBan(12L);

        verify(banRecordRepository).releaseActiveBan(eq(12L), any(LocalDateTime.class));
        verify(banRecordRepository, never()).existsById(12L);
    }

    @Test
    void missingRecordReturnsNotFound() {
        // 해당 기록이 없으면 404를 반환한다.
        assertThatThrownBy(() -> service.releaseUserBan(12L))
                .isInstanceOfSatisfying(AdminException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(NOT_EXISTS_BAN_RECORD));
    }

    @Test
    void alreadyReleasedOrExpiredRecordReturnsConflict() {
        // 이미 해제됐거나 기간이 끝난 기록은 다시 해제할 수 없다.
        when(banRecordRepository.existsById(12L)).thenReturn(true);

        assertThatThrownBy(() -> service.releaseUserBan(12L))
                .isInstanceOfSatisfying(AdminException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(NOT_ACTIVE_BAN_RECORD));

        verify(banRecordRepository).releaseActiveBan(eq(12L), any(LocalDateTime.class));
    }
}
