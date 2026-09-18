package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu._util.service.S3Service;
import com.s15p21b103.good_tashu.admin.dto.res.AdminCycleClaimDetailResponse;
import com.s15p21b103.good_tashu.claim.domain.ClaimEntity;
import com.s15p21b103.good_tashu.cycle.domain.CycleEntity;
import com.s15p21b103.good_tashu.cycle.domain.CycleUsageEntity;
import com.s15p21b103.good_tashu.claim.repository.ClaimReportRepository;
import com.s15p21b103.good_tashu.claim.repository.ClaimRepository;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminCycleClaimDetailPhotoTest {
    @Mock
    ClaimRepository cycleClaimRepository;
    @Mock
    ClaimReportRepository cycleClaimReportRepository;
    @Mock S3Service s3Service;
    @InjectMocks AdminCycleService adminCycleService;

    @Test
    void includesPresignedPhotoUrlWhenClaimHasPhoto() {
        when(cycleClaimRepository.findById(10L)).thenReturn(Optional.of(claim("images/photo-key")));
        when(cycleClaimReportRepository.findAllByClaimEntity_ClaimIdOrderByCreatedAtDescClaimReportIdDesc(10L))
                .thenReturn(List.of());
        when(s3Service.createDownloadUrl("images/photo-key"))
                .thenReturn("https://example.com/photo?signature=123");

        AdminCycleClaimDetailResponse response = adminCycleService.getCycleClaimDetail(10L);

        assertThat(response.photoUrl()).isEqualTo("https://example.com/photo?signature=123");
        verify(s3Service).createDownloadUrl("images/photo-key");
    }

    @Test
    void returnsNullPhotoUrlWithoutCallingS3WhenPhotoIsAbsent() {
        when(cycleClaimRepository.findById(10L)).thenReturn(Optional.of(claim(null)));
        when(cycleClaimReportRepository.findAllByClaimEntity_ClaimIdOrderByCreatedAtDescClaimReportIdDesc(10L))
                .thenReturn(List.of());

        AdminCycleClaimDetailResponse response = adminCycleService.getCycleClaimDetail(10L);

        assertThat(response.photoUrl()).isNull();
        verifyNoInteractions(s3Service);
    }

    private ClaimEntity claim(String path) {
        UserEntity user = mock(UserEntity.class);
        CycleEntity cycle = CycleEntity.builder().cycleId("C1").build();
        CycleUsageEntity usage = CycleUsageEntity.builder()
                .cycleUsageId(100L).cycleEntity(cycle).userEntity(user).build();
        return ClaimEntity.builder().claimId(10L).cycleEntity(cycle).userEntity(user).path(path).build();
    }
}
