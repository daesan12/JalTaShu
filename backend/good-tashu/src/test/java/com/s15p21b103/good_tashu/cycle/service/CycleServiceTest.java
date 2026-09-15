package com.s15p21b103.good_tashu.cycle.service;

import com.s15p21b103.good_tashu._util.service.S3Service;
import com.s15p21b103.good_tashu.cycle.domain.*;
import com.s15p21b103.good_tashu.cycle.dto.req.*;
import com.s15p21b103.good_tashu.cycle.event.CycleRentalStartedEvent;
import com.s15p21b103.good_tashu.cycle.event.CycleReturnEvent;
import com.s15p21b103.good_tashu.cycle.exception.CycleException;
import com.s15p21b103.good_tashu.cycle.repository.*;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.exception.UserException;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static com.s15p21b103.good_tashu.cycle.exception.CycleErrorCode.*;
import static com.s15p21b103.good_tashu.user.exception.UserErrorCode.NOT_EXISTS_USER;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CycleServiceTest {
    @Mock CycleRepository cycleRepository;
    @Mock CycleUsageRepository cycleUsageRepository;
    @Mock UserRepository userRepository;
    @Mock ApplicationEventPublisher eventPublisher;
    @Mock StationRepository stationRepository;
    @Mock CycleClaimRepository cycleClaimRepository;
    @Mock CycleClaimReportRepository cycleClaimReportRepository;
    @Mock S3Service s3Service;
    @Mock com.s15p21b103.good_tashu.path.repository.PathRepository pathRepository;
    @InjectMocks CycleService cycleService;

    private final UserEntity user = UserEntity.builder().nickname("타슈이용자").build();
    private final StationEntity station = StationEntity.builder().stationId("S1").build();
    private final CycleEntity cycle = CycleEntity.builder()
            .cycleId("C1").status(CycleStatus.READY).stationEntity(station).build();

    private void existingUserAndCycle() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(cycleRepository.findById("C1")).thenReturn(Optional.of(cycle));
    }

    private void claimEligibility(boolean eligible) {
        existingUserAndCycle();
        when(cycleUsageRepository.existsByUserEntityAndCycleEntityAndReturnAtBetween(
                eq(user), eq(cycle), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(eligible);
    }

    private CycleClaimRequest claimRequest(MultipartFile file) {
        return new CycleClaimRequest("C1", ClaimCategory.TIRE, "타이어 펑크", file);
    }

    @Test
    void rentalPreservesDepartureStationInUsageHistory() {
        existingUserAndCycle();

        LocalDateTime rentalAt = cycleService.rentalCycle(1L, new CycleRentalRequest("C1"));

        var usageCaptor = ArgumentCaptor.forClass(CycleUsageEntity.class);
        verify(cycleUsageRepository).save(usageCaptor.capture());
        assertThat(cycle.getStatus()).isEqualTo(CycleStatus.RENTING);
        assertThat(cycle.getStationEntity()).isNull();
        assertThat(usageCaptor.getValue().getUserEntity()).isSameAs(user);
        assertThat(usageCaptor.getValue().getCycleEntity()).isSameAs(cycle);
        assertThat(usageCaptor.getValue().getRentalAt()).isEqualTo(rentalAt);
        verify(eventPublisher).publishEvent(new CycleRentalStartedEvent(1L, rentalAt));
        // 자전거의 현재 대여소를 비워도 이력에는 출발 대여소가 남아야 한다.
        assertThat(usageCaptor.getValue().getRentalStationEntity()).isSameAs(station);
    }

    @Test
    void rentalRejectsMissingUserWithoutWritingAnything() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> cycleService.rentalCycle(1L, new CycleRentalRequest("C1")))
                .isInstanceOfSatisfying(UserException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXISTS_USER));
        verifyNoInteractions(cycleRepository, cycleUsageRepository, eventPublisher);
    }

    @Test
    void rentalRejectsMissingCycle() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(cycleRepository.findById("C1")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> cycleService.rentalCycle(1L, new CycleRentalRequest("C1")))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXIST_CYCLE_ID));
        verifyNoInteractions(cycleUsageRepository, eventPublisher);
    }

    @Test
    void rentalRejectsUnavailableCycle() {
        existingUserAndCycle();
        cycle.setStatus(CycleStatus.RENTING);
        assertThatThrownBy(() -> cycleService.rentalCycle(1L, new CycleRentalRequest("C1")))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(CYCLE_NOT_READY));
        verifyNoInteractions(cycleUsageRepository, eventPublisher);
    }

    @Test
    void rentalRejectsUserAlreadyRentingWithoutChangingCycle() {
        existingUserAndCycle();
        when(cycleUsageRepository.existsByUserEntity_UserIdAndReturnAtIsNull(1L)).thenReturn(true);
        assertThatThrownBy(() -> cycleService.rentalCycle(1L, new CycleRentalRequest("C1")))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(ALREADY_RENTING));
        assertThat(cycle.getStatus()).isEqualTo(CycleStatus.READY);
        verify(cycleUsageRepository, never()).save(any());
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void returnUpdatesCycleUsageAndPublishesMatchingTimestamp() {
        existingUserAndCycle();
        cycle.setStatus(CycleStatus.RENTING);
        when(stationRepository.findById("S1")).thenReturn(Optional.of(station));
        CycleUsageEntity usage = CycleUsageEntity.builder().userEntity(user).cycleEntity(cycle).build();
        when(cycleUsageRepository.findByUserEntityAndCycleEntityAndReturnAtIsNull(user, cycle))
                .thenReturn(Optional.of(usage));

        LocalDateTime returnedAt = cycleService.returnCycle(1L, new CycleReturnRequest("C1", "S1"));

        assertThat(cycle.getStatus()).isEqualTo(CycleStatus.READY);
        assertThat(cycle.getStationEntity()).isSameAs(station);
        assertThat(usage.getReturnStationEntity()).isSameAs(station);
        assertThat(usage.getReturnAt()).isEqualTo(returnedAt);
        verify(eventPublisher).publishEvent(new CycleReturnEvent(1L, returnedAt));
    }

    @Test
    void returnRejectsMissingStation() {
        existingUserAndCycle();
        when(stationRepository.findById("S1")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> cycleService.returnCycle(1L, new CycleReturnRequest("C1", "S1")))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXIST_STATION_ID));
        verifyNoInteractions(cycleUsageRepository, eventPublisher);
    }

    @Test
    void returnRejectsCycleNotBeingRented() {
        existingUserAndCycle();
        when(stationRepository.findById("S1")).thenReturn(Optional.of(station));
        assertThatThrownBy(() -> cycleService.returnCycle(1L, new CycleReturnRequest("C1", "S1")))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(CYCLE_NOT_RENTING));
        verifyNoInteractions(cycleUsageRepository, eventPublisher);
    }

    @Test
    void returnRejectsRentalBelongingToAnotherUser() {
        existingUserAndCycle();
        cycle.setStatus(CycleStatus.RENTING);
        when(stationRepository.findById("S1")).thenReturn(Optional.of(station));
        when(cycleUsageRepository.findByUserEntityAndCycleEntityAndReturnAtIsNull(user, cycle))
                .thenReturn(Optional.empty());
        assertThatThrownBy(() -> cycleService.returnCycle(1L, new CycleReturnRequest("C1", "S1")))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(CYCLE_NOT_RENTING));
        assertThat(cycle.getStatus()).isEqualTo(CycleStatus.RENTING);
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void claimUploadsPhotoAndSavesAuthorCategoryAndPath() {
        claimEligibility(true);
        var photo = new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[]{1});
        when(s3Service.uploadImage(photo)).thenReturn("images/test-key");
        when(cycleClaimRepository.save(any())).thenReturn(CycleClaimEntity.builder().id(10L).build());

        assertThat(cycleService.claimCycle(1L, claimRequest(photo)).claimId()).isEqualTo(10L);

        var captor = ArgumentCaptor.forClass(CycleClaimEntity.class);
        var order = inOrder(s3Service, cycleClaimRepository);
        order.verify(s3Service).uploadImage(photo);
        order.verify(cycleClaimRepository).save(captor.capture());
        assertThat(captor.getValue().getUserEntity()).isSameAs(user);
        assertThat(captor.getValue().getCycleEntity()).isSameAs(cycle);
        assertThat(captor.getValue().getClaimCategory()).isEqualTo(ClaimCategory.TIRE);
        assertThat(captor.getValue().getContent()).isEqualTo("타이어 펑크");
        assertThat(captor.getValue().getStatus()).isEqualTo(ClaimStatus.READY);
        assertThat(captor.getValue().getPath()).isEqualTo("images/test-key");
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void claimWithoutPhotoStoresNullPath(boolean emptyPart) {
        claimEligibility(true);
        when(cycleClaimRepository.save(any())).thenReturn(CycleClaimEntity.builder().id(10L).build());
        MultipartFile photo = emptyPart ? new MockMultipartFile("file", new byte[0]) : null;

        cycleService.claimCycle(1L, claimRequest(photo));

        var captor = ArgumentCaptor.forClass(CycleClaimEntity.class);
        verify(cycleClaimRepository).save(captor.capture());
        assertThat(captor.getValue().getPath()).isNull();
        verifyNoInteractions(s3Service);
    }

    @Test
    void claimUsesExactOneDayWindowAndRejectsIneligibleUserBeforeUpload() {
        claimEligibility(false);
        LocalDateTime before = LocalDateTime.now();
        var photo = new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[]{1});
        assertThatThrownBy(() -> cycleService.claimCycle(1L, claimRequest(photo)))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(CANT_WRITE_CLAIM));
        LocalDateTime after = LocalDateTime.now();

        var from = ArgumentCaptor.forClass(LocalDateTime.class);
        var to = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(cycleUsageRepository).existsByUserEntityAndCycleEntityAndReturnAtBetween(
                eq(user), eq(cycle), from.capture(), to.capture());
        assertThat(Duration.between(from.getValue(), to.getValue())).isEqualTo(Duration.ofDays(1));
        assertThat(to.getValue()).isBetween(before, after);
        verifyNoInteractions(s3Service, cycleClaimRepository);
    }

    @Test
    void uploadFailureDoesNotSaveClaim() {
        claimEligibility(true);
        var photo = new MockMultipartFile("file", "bad.exe", "application/octet-stream", new byte[]{1});
        when(s3Service.uploadImage(photo)).thenThrow(new IllegalArgumentException("사진 확장자 오류"));
        assertThatThrownBy(() -> cycleService.claimCycle(1L, claimRequest(photo)))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(cycleClaimRepository);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t"})
    void claimListRejectsBlankCycleId(String cycleId) {
        assertThatThrownBy(() -> cycleService.getCycleClaims(cycleId))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(CYCLE_ID_REQUIRED));
        verifyNoInteractions(cycleRepository, cycleClaimRepository);
    }

    @Test
    void claimListRejectsMissingCycle() {
        when(cycleRepository.existsById("C1")).thenReturn(false);
        assertThatThrownBy(() -> cycleService.getCycleClaims("C1"))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXIST_CYCLE_ID));
        verifyNoInteractions(cycleClaimRepository);
    }

    @Test
    void claimListReturnsRequestedFields() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 9, 10, 10, 0);
        var claim = CycleClaimEntity.builder().id(10L).userEntity(user).cycleEntity(cycle)
                .claimCategory(ClaimCategory.TIRE).content("타이어 펑크").createdAt(createdAt).build();
        when(cycleRepository.existsById("C1")).thenReturn(true);
        when(cycleClaimRepository.findAllByCycleEntity_CycleIdOrderByCreatedAtDescIdDesc("C1"))
                .thenReturn(List.of(claim));

        assertThat(cycleService.getCycleClaims("C1")).singleElement().satisfies(response -> {
            assertThat(response.claimId()).isEqualTo(10L);
            assertThat(response.nickname()).isEqualTo("타슈이용자");
            assertThat(response.claimCategory()).isEqualTo(ClaimCategory.TIRE);
            assertThat(response.content()).isEqualTo("타이어 펑크");
            assertThat(response.createdAt()).isEqualTo(createdAt);
        });
    }

    @Test
    void claimListReturnsEmptyListForCycleWithoutClaims() {
        when(cycleRepository.existsById("C1")).thenReturn(true);
        when(cycleClaimRepository.findAllByCycleEntity_CycleIdOrderByCreatedAtDescIdDesc("C1"))
                .thenReturn(List.of());
        assertThat(cycleService.getCycleClaims("C1")).isEmpty();
    }

    @ParameterizedTest
    @EnumSource(ClaimReportCategory.class)
    void reportSavesReporterTargetAndEachSupportedCategory(ClaimReportCategory category) {
        var claim = CycleClaimEntity.builder().id(10L).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(cycleClaimRepository.findById(10L)).thenReturn(Optional.of(claim));

        cycleService.reportCycleClaim(1L, 10L, category);

        var captor = ArgumentCaptor.forClass(CycleClaimReportEntity.class);
        verify(cycleClaimReportRepository).save(captor.capture());
        assertThat(captor.getValue().getUserEntity()).isSameAs(user);
        assertThat(captor.getValue().getCycleClaimEntity()).isSameAs(claim);
        assertThat(captor.getValue().getClaimCategory()).isEqualTo(category);
    }

    @Test
    void reportRejectsMissingCategoryBeforeDatabaseAccess() {
        assertThatThrownBy(() -> cycleService.reportCycleClaim(1L, 10L, null))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(CLAIM_REPORT_CATEGORY_REQUIRED));
        verifyNoInteractions(userRepository, cycleClaimRepository, cycleClaimReportRepository);
    }

    @Test
    void reportRejectsMissingUser() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> cycleService.reportCycleClaim(1L, 10L, ClaimReportCategory.ABUSE))
                .isInstanceOfSatisfying(UserException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXISTS_USER));
        verifyNoInteractions(cycleClaimRepository, cycleClaimReportRepository);
    }

    @Test
    void reportRejectsMissingClaimWithoutSaving() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(cycleClaimRepository.findById(10L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> cycleService.reportCycleClaim(1L, 10L, ClaimReportCategory.ABUSE))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXIST_CLAIM_ID));
        verifyNoInteractions(cycleClaimReportRepository);
    }
}
