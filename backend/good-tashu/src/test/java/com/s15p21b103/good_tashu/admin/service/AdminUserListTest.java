package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu.admin.dto.res.AdminUserListResponse;
import com.s15p21b103.good_tashu.admin.repository.AdminUserRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminUserListTest {
    @Test
    void userListIncludesNickname() {
        // 목록 조회 결과의 닉네임을 응답 DTO에 그대로 전달한다.
        AdminUserRepository repository = mock(AdminUserRepository.class);
        AdminUserRepository.UserSummary summary = mock(AdminUserRepository.UserSummary.class);
        LocalDateTime recentUsingAt = LocalDateTime.of(2026, 9, 17, 12, 0);
        when(summary.getUserId()).thenReturn(7L);
        when(summary.getNickname()).thenReturn("타슈이용자");
        when(summary.getRecentUsingAt()).thenReturn(recentUsingAt);
        when(summary.getUserStatement()).thenReturn("NORMAL");
        when(repository.findUserSummaries("", "newest")).thenReturn(List.of(summary));
        AdminUserService service = new AdminUserService(repository, null, null, null, null);

        List<AdminUserListResponse> responses = service.getUserList("", "newest");

        assertThat(responses).containsExactly(new AdminUserListResponse(
                7L, "타슈이용자", recentUsingAt, "NORMAL"));
    }
}
