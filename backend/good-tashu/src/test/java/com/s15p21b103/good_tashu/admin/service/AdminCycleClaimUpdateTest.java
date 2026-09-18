package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu.admin.dto.req.AdminCycleClaimUpdateRequest;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleClaimUpdateResponse;
import com.s15p21b103.good_tashu.admin.exception.AdminException;
import com.s15p21b103.good_tashu.claim.domain.ClaimStatus;
import com.s15p21b103.good_tashu.claim.domain.ClaimEntity;
import com.s15p21b103.good_tashu.claim.repository.ClaimRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.INVALID_CLAIM_ID;
import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.INVALID_CLAIM_STATUS;
import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.NOT_EXISTS_CLAIM;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminCycleClaimUpdateTest {
    @Mock
    ClaimRepository cycleClaimRepository;
    @InjectMocks AdminCycleService adminCycleService;

    @Test
    void updatesStatusAndComment() {
        ClaimEntity claim = ClaimEntity.builder()
                .claimId(10L).status(ClaimStatus.READY).build();
        when(cycleClaimRepository.findById(10L)).thenReturn(Optional.of(claim));

        AdminCycleClaimUpdateResponse response = adminCycleService.updateCycleClaim(
                10L, new AdminCycleClaimUpdateRequest(ClaimStatus.IN_PROGRESS, "수리 중"));

        assertThat(response.claimId()).isEqualTo(10L);
        assertThat(claim.getStatus()).isEqualTo(ClaimStatus.IN_PROGRESS);
        assertThat(claim.getAdminComment()).isEqualTo("수리 중");
    }

    @Test
    void omittedCommentPreservesExistingComment() {
        ClaimEntity claim = ClaimEntity.builder()
                .claimId(10L).status(ClaimStatus.IN_PROGRESS).adminComment("수리 중").build();
        when(cycleClaimRepository.findById(10L)).thenReturn(Optional.of(claim));

        adminCycleService.updateCycleClaim(
                10L, new AdminCycleClaimUpdateRequest(ClaimStatus.COMPLETED, null));

        assertThat(claim.getStatus()).isEqualTo(ClaimStatus.COMPLETED);
        assertThat(claim.getAdminComment()).isEqualTo("수리 중");
    }

    @Test
    void invalidClaimIdIsRejectedBeforeLookup() {
        assertThatThrownBy(() -> adminCycleService.updateCycleClaim(
                0L, new AdminCycleClaimUpdateRequest(ClaimStatus.READY, null)))
                .isInstanceOfSatisfying(AdminException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(INVALID_CLAIM_ID));
        verifyNoInteractions(cycleClaimRepository);
    }

    @Test
    void missingStatusIsRejectedBeforeLookup() {
        assertThatThrownBy(() -> adminCycleService.updateCycleClaim(
                10L, new AdminCycleClaimUpdateRequest(null, null)))
                .isInstanceOfSatisfying(AdminException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(INVALID_CLAIM_STATUS));
        verifyNoInteractions(cycleClaimRepository);
    }

    @Test
    void missingClaimIsRejected() {
        when(cycleClaimRepository.findById(10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminCycleService.updateCycleClaim(
                10L, new AdminCycleClaimUpdateRequest(ClaimStatus.READY, null)))
                .isInstanceOfSatisfying(AdminException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXISTS_CLAIM));
    }
}
