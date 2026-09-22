package com.s15p21b103.good_tashu.admin.controller;

import com.s15p21b103.good_tashu.admin.service.AdminUserService;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminUserBanReleaseControllerTest {
    @Test
    void releaseEndpointPassesBanRecordId() throws Exception {
        // 새 경로의 ID가 서비스에 제재 기록 ID로 전달되는지 확인한다.
        AdminUserService service = mock(AdminUserService.class);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AdminController(service, null, null)).build();

        mvc.perform(post("/api/admin/user/ban/12/release"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("사용자 밴이 해제되었습니다."));

        verify(service).releaseUserBan(12L);
    }
}
