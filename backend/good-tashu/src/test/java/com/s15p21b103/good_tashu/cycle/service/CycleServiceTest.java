package com.s15p21b103.good_tashu.cycle.service;

import com.s15p21b103.good_tashu._util.service.S3Service;
import com.s15p21b103.good_tashu.claim.domain.*;
import com.s15p21b103.good_tashu.claim.service.ClaimService;
import com.s15p21b103.good_tashu.claim.dto.req.CycleClaimRequest;
import com.s15p21b103.good_tashu.claim.repository.ClaimReportRepository;
import com.s15p21b103.good_tashu.claim.repository.ClaimRepository;
import com.s15p21b103.good_tashu.cycle.domain.*;
import com.s15p21b103.good_tashu.cycle.dto.req.*;
import com.s15p21b103.good_tashu.cycle.event.CycleRentalStartedEvent;
import com.s15p21b103.good_tashu.cycle.event.CycleReturnEvent;
import com.s15p21b103.good_tashu.cycle.exception.CycleException;
import com.s15p21b103.good_tashu.claim.exception.ClaimException;
import static com.s15p21b103.good_tashu.claim.exception.ClaimErrorCode.*;
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
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.math.BigDecimal;
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
    @Mock
    ClaimRepository cycleClaimRepository;
    @Mock
    ClaimReportRepository cycleClaimReportRepository;
    @Mock S3Service s3Service;
    @Mock com.s15p21b103.good_tashu.path.repository.PathRepository pathRepository;
    @InjectMocks CycleService cycleService;
    @InjectMocks ClaimService claimService;

    private final UserEntity user = UserEntity.builder().nickname("타슈이용자").build();
    private static final BigDecimal LATITUDE = new BigDecimal("36.350400");
    private static final BigDecimal LONGITUDE = new BigDecimal("127.384500");

    private final StationEntity station = StationEntity.builder().stationId("S1")
            .latitude(LATITUDE).longitude(LONGITUDE).build();
    private final CycleEntity cycle = CycleEntity.builder()
            .cycleId("C1").status(CycleStatus.READY).stationEntity(station).build();

    private void existingUserAndCycle() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(cycleRepository.findById("C1")).thenReturn(Optional.of(cycle));
    }

    private CycleClaimRequest claimRequest(MultipartFile file) {
        return new CycleClaimRequest("C1", ClaimCategory.TIRE, "타이어 펑크", file);
    }

    @Test
    void statementReturnsLatestUsageStationAndRideableState() {
        LocalDateTime rentalAt = LocalDateTime.of(2026, 9, 22, 10, 0);
        StationEntity rentalStation = StationEntity.builder().stationId("S1").name("출발 대여소").build();
        StationEntity returnStation = StationEntity.builder().stationId("S2").name("최근 대여소").build();
        CycleEntity target = CycleEntity.builder()
                .cycleId("C1").status(CycleStatus.READY).stationEntity(returnStation).build();
        CycleUsageEntity latestUsage = CycleUsageEntity.builder()
                .cycleEntity(target)
                .rentalStationEntity(rentalStation)
                .returnStationEntity(returnStation)
                .rentalAt(rentalAt)
                .build();
        when(cycleRepository.findById("C1")).thenReturn(Optional.of(target));
        when(cycleUsageRepository
                .findFirstByCycleEntity_CycleIdOrderByRentalAtDescCycleUsageIdDesc("C1"))
                .thenReturn(Optional.of(latestUsage));
        when(cycleClaimRepository.existsByCycleEntity_CycleIdAndClaimTypeAndStatusNot(
                "C1", ClaimType.CYCLE, ClaimStatus.COMPLETED)).thenReturn(true);

        var response = cycleService.getCycleStatement("c1");

        assertThat(response.cycleId()).isEqualTo("C1");
        assertThat(response.rideable()).isFalse();
        assertThat(response.lastUsedAt()).isEqualTo(rentalAt);
        assertThat(response.lastStationName()).isEqualTo("최근 대여소");
    }

    @Test
    void statementRejectsMissingCycle() {
        when(cycleRepository.findById("C404")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> cycleService.getCycleStatement("C404"))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXIST_CYCLE_ID));
        verifyNoInteractions(cycleUsageRepository, cycleClaimRepository);
    }

    private CycleRentalRequest rentalRequest(String cycleId, String stationId) {
        return new CycleRentalRequest(cycleId, stationId, LATITUDE, LONGITUDE);
    }

    private CycleReturnRequest returnRequest(String cycleId, String stationId) {
        return new CycleReturnRequest(cycleId, stationId, LATITUDE, LONGITUDE);
    }

    @Test
    void rentalPreservesDepartureStationInUsageHistory() {
        existingUserAndCycle();

        when(stationRepository.findById("S1")).thenReturn(Optional.of(station));
        LocalDateTime rentalAt = cycleService.rentalCycle(1L, rentalRequest("C1", "S1"));

        ArgumentCaptor<CycleUsageEntity> usageCaptor = ArgumentCaptor.forClass(CycleUsageEntity.class);
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
        assertThatThrownBy(() -> cycleService.rentalCycle(1L, rentalRequest("C1", "S1")))
                .isInstanceOfSatisfying(UserException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXISTS_USER));
        verifyNoInteractions(cycleRepository, cycleUsageRepository, eventPublisher);
    }

    // 타슈 공공 API가 개별 자전거 정보를 주지 않아 자전거 마스터를 미리 채울 수 없다.
    // 처음 보는 번호는 대여 시점에 등록된다 — 등록하지 않으면 대여 자체가 성립하지 않는다.
    @Test
    void rentalRegistersUnknownCycleAtTheStationTheRiderIsStandingAt() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(cycleRepository.findById("C2")).thenReturn(Optional.empty());
        when(stationRepository.findById("S1")).thenReturn(Optional.of(station));
        when(cycleRepository.save(any(CycleEntity.class))).thenAnswer(call -> call.getArgument(0));

        LocalDateTime rentalAt = cycleService.rentalCycle(1L, rentalRequest("C2", "S1"));

        ArgumentCaptor<CycleEntity> cycleCaptor = ArgumentCaptor.forClass(CycleEntity.class);
        verify(cycleRepository).save(cycleCaptor.capture());
        assertThat(cycleCaptor.getValue().getCycleId()).isEqualTo("C2");
        // 등록된 뒤 곧바로 대여되므로 저장 시점의 READY는 startRental()이 RENTING으로 바꾼다
        assertThat(cycleCaptor.getValue().getStatus()).isEqualTo(CycleStatus.RENTING);

        ArgumentCaptor<CycleUsageEntity> usageCaptor = ArgumentCaptor.forClass(CycleUsageEntity.class);
        verify(cycleUsageRepository).save(usageCaptor.capture());
        // 출발 대여소는 요청이 준 "현재 위치에서 가장 가까운 대여소"다
        assertThat(usageCaptor.getValue().getRentalStationEntity()).isSameAs(station);
        verify(eventPublisher).publishEvent(new CycleRentalStartedEvent(1L, rentalAt));
    }

    @Test
    void rentalRejectsWhenLocationIsUnknown() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        assertThatThrownBy(() -> cycleService.rentalCycle(1L,
                new CycleRentalRequest("C2", "S1", null, null)))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(CURRENT_LOCATION_REQUIRED));
        verifyNoInteractions(stationRepository, cycleRepository, cycleUsageRepository, eventPublisher);
    }

    @Test
    void rentalRejectsUnknownStationWithoutRegisteringCycle() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(stationRepository.findById("S404")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> cycleService.rentalCycle(1L, rentalRequest("C2", "S404")))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXIST_STATION_ID));
        verify(cycleRepository, never()).save(any());
        verifyNoInteractions(cycleUsageRepository, eventPublisher);
    }

    @Test
    void rentalRejectsStationMoreThan300MetersAway() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(stationRepository.findById("S1")).thenReturn(Optional.of(station));

        assertThatThrownBy(() -> cycleService.rentalCycle(1L,
                new CycleRentalRequest("C2", "S1", new BigDecimal("36.354000"), LONGITUDE)))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(STATION_TOO_FAR));
        verifyNoInteractions(cycleRepository, cycleUsageRepository, eventPublisher);
    }

    // 소문자로 입력해도 같은 자전거다 — 대소문자만 다른 행이 따로 생기면 이력이 갈린다.
    @Test
    void rentalLooksUpCycleIdInUpperCase() {
        existingUserAndCycle();

        when(stationRepository.findById("S1")).thenReturn(Optional.of(station));
        cycleService.rentalCycle(1L, rentalRequest("c1", "S1"));

        verify(cycleRepository).findById("C1");
        verify(cycleRepository, never()).save(any());
        verify(cycleUsageRepository).save(any());
    }

    @Test
    void rentalRejectsUnavailableCycle() {
        existingUserAndCycle();
        cycle.setStatus(CycleStatus.RENTING);
        when(stationRepository.findById("S1")).thenReturn(Optional.of(station));
        assertThatThrownBy(() -> cycleService.rentalCycle(1L, rentalRequest("C1", "S1")))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(CYCLE_NOT_READY));
        verifyNoInteractions(cycleUsageRepository, eventPublisher);
    }

    @Test
    void rentalRejectsUserAlreadyRentingWithoutChangingCycle() {
        existingUserAndCycle();
        when(cycleUsageRepository.existsByUserEntity_UserIdAndReturnAtIsNull(1L)).thenReturn(true);
        when(stationRepository.findById("S1")).thenReturn(Optional.of(station));
        assertThatThrownBy(() -> cycleService.rentalCycle(1L, rentalRequest("C1", "S1")))
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

        LocalDateTime returnedAt = cycleService.returnCycle(1L, returnRequest("C1", "S1"));

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
        assertThatThrownBy(() -> cycleService.returnCycle(1L, returnRequest("C1", "S1")))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXIST_STATION_ID));
        verifyNoInteractions(cycleUsageRepository, eventPublisher);
    }

    @Test
    void returnRejectsCycleNotBeingRented() {
        existingUserAndCycle();
        when(stationRepository.findById("S1")).thenReturn(Optional.of(station));
        assertThatThrownBy(() -> cycleService.returnCycle(1L, returnRequest("C1", "S1")))
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
        assertThatThrownBy(() -> cycleService.returnCycle(1L, returnRequest("C1", "S1")))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(CYCLE_NOT_RENTING));
        assertThat(cycle.getStatus()).isEqualTo(CycleStatus.RENTING);
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void returnRejectsStationMoreThan300MetersAway() {
        existingUserAndCycle();
        cycle.setStatus(CycleStatus.RENTING);
        when(stationRepository.findById("S1")).thenReturn(Optional.of(station));

        assertThatThrownBy(() -> cycleService.returnCycle(1L,
                new CycleReturnRequest("C1", "S1", new BigDecimal("36.354000"), LONGITUDE)))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(STATION_TOO_FAR));
        verifyNoInteractions(cycleUsageRepository, eventPublisher);
    }

    @Test
    void claimUploadsPhotoAndSavesAuthorCategoryAndPath() {
        existingUserAndCycle();
        MockMultipartFile photo = new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[]{1});
        when(s3Service.uploadImage(photo)).thenReturn("images/test-key");
        when(cycleClaimRepository.save(any())).thenReturn(ClaimEntity.builder().claimId(10L).build());

        assertThat(claimService.claimCycle(1L, claimRequest(photo)).claimId()).isEqualTo(10L);

        ArgumentCaptor<ClaimEntity> captor = ArgumentCaptor.forClass(ClaimEntity.class);
        InOrder order = inOrder(s3Service, cycleClaimRepository);
        order.verify(s3Service).uploadImage(photo);
        order.verify(cycleClaimRepository).save(captor.capture());
        assertThat(captor.getValue().getUserEntity()).isSameAs(user);
        verifyNoInteractions(cycleUsageRepository);
        assertThat(captor.getValue().getCycleEntity()).isSameAs(cycle);
        assertThat(captor.getValue().getClaimCategory()).isEqualTo(ClaimCategory.TIRE);
        assertThat(captor.getValue().getContent()).isEqualTo("타이어 펑크");
        assertThat(captor.getValue().getStatus()).isEqualTo(ClaimStatus.READY);
        assertThat(captor.getValue().getPath()).isEqualTo("images/test-key");
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void claimWithoutPhotoStoresNullPath(boolean emptyPart) {
        existingUserAndCycle();
        when(cycleClaimRepository.save(any())).thenReturn(ClaimEntity.builder().claimId(10L).build());
        MultipartFile photo = emptyPart ? new MockMultipartFile("file", new byte[0]) : null;

        claimService.claimCycle(1L, claimRequest(photo));

        ArgumentCaptor<ClaimEntity> captor = ArgumentCaptor.forClass(ClaimEntity.class);
        verify(cycleClaimRepository).save(captor.capture());
        assertThat(captor.getValue().getPath()).isNull();
        verifyNoInteractions(s3Service);
    }

    @Test
    void claimStoresDirectCycleAndAuthorWithoutUsage() {
        existingUserAndCycle();
        when(cycleClaimRepository.save(any()))
                .thenReturn(ClaimEntity.builder().claimId(10L).build());

        assertThat(claimService.claimCycle(1L, claimRequest(null)).claimId()).isEqualTo(10L);

        ArgumentCaptor<ClaimEntity> captor = ArgumentCaptor.forClass(ClaimEntity.class);
        verify(cycleClaimRepository).save(captor.capture());
        assertThat(captor.getValue().getCycleEntity()).isSameAs(cycle);
        assertThat(captor.getValue().getUserEntity()).isSameAs(user);
    }

    @Test
    void uploadFailureDoesNotSaveClaim() {
        existingUserAndCycle();
        MockMultipartFile photo = new MockMultipartFile("file", "bad.exe", "application/octet-stream", new byte[]{1});
        when(s3Service.uploadImage(photo)).thenThrow(new IllegalArgumentException("사진 확장자 오류"));
        assertThatThrownBy(() -> claimService.claimCycle(1L, claimRequest(photo)))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(cycleClaimRepository);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t"})
    void claimListRejectsBlankCycleId(String cycleId) {
        assertThatThrownBy(() -> claimService.getCycleClaims(cycleId))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(CYCLE_ID_REQUIRED));
        verifyNoInteractions(cycleRepository, cycleClaimRepository);
    }

    @Test
    void claimListRejectsMissingCycle() {
        when(cycleRepository.existsById("C1")).thenReturn(false);
        assertThatThrownBy(() -> claimService.getCycleClaims("C1"))
                .isInstanceOfSatisfying(CycleException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXIST_CYCLE_ID));
        verifyNoInteractions(cycleClaimRepository);
    }

    @Test
    void claimListReturnsRequestedFields() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 9, 10, 10, 0);
        CycleUsageEntity usage = CycleUsageEntity.builder().cycleUsageId(100L)
                .userEntity(user).cycleEntity(cycle).build();
        ClaimEntity claim = ClaimEntity.builder().claimId(10L).cycleEntity(cycle).userEntity(user)
                .claimCategory(ClaimCategory.TIRE).content("타이어 펑크").createdAt(createdAt).build();
        when(cycleRepository.existsById("C1")).thenReturn(true);
        when(cycleClaimRepository.findAllByCycleEntity_CycleIdOrderByCreatedAtDescClaimIdDesc("C1"))
                .thenReturn(List.of(claim));

        assertThat(claimService.getCycleClaims("C1")).singleElement().satisfies(response -> {
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
        when(cycleClaimRepository.findAllByCycleEntity_CycleIdOrderByCreatedAtDescClaimIdDesc("C1"))
                .thenReturn(List.of());
        assertThat(claimService.getCycleClaims("C1")).isEmpty();
    }

    @ParameterizedTest
    @EnumSource(ClaimReportCategory.class)
    void reportSavesReporterTargetAndEachSupportedCategory(ClaimReportCategory category) {
        ClaimEntity claim = ClaimEntity.builder().claimId(10L).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(cycleClaimRepository.findById(10L)).thenReturn(Optional.of(claim));

        claimService.reportClaim(1L, 10L, category);

        ArgumentCaptor<ClaimReportEntity> captor = ArgumentCaptor.forClass(ClaimReportEntity.class);
        verify(cycleClaimReportRepository).save(captor.capture());
        assertThat(captor.getValue().getUserEntity()).isSameAs(user);
        assertThat(captor.getValue().getClaimEntity()).isSameAs(claim);
        assertThat(captor.getValue().getReportCategory()).isEqualTo(category);
    }

    @Test
    void reportRejectsMissingCategoryBeforeDatabaseAccess() {
        assertThatThrownBy(() -> claimService.reportClaim(1L, 10L, null))
                .isInstanceOfSatisfying(ClaimException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(CLAIM_REPORT_CATEGORY_REQUIRED));
        verifyNoInteractions(userRepository, cycleClaimRepository, cycleClaimReportRepository);
    }

    @Test
    void reportRejectsDuplicateEvenWithDifferentCategory() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(cycleClaimRepository.findById(10L)).thenReturn(Optional.of(ClaimEntity.builder().claimId(10L).build()));
        when(cycleClaimReportRepository.existsByClaimEntity_ClaimIdAndUserEntity_UserId(10L, 1L)).thenReturn(true);

        assertThatThrownBy(() -> claimService.reportClaim(1L, 10L, ClaimReportCategory.ETC))
                .isInstanceOfSatisfying(ClaimException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(ALREADY_REPORTED_CLAIM));
        verify(cycleClaimReportRepository, never()).save(any());
    }

    @Test
    void reportRejectsMissingUser() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> claimService.reportClaim(1L, 10L, ClaimReportCategory.ABUSE))
                .isInstanceOfSatisfying(UserException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXISTS_USER));
        verifyNoInteractions(cycleClaimRepository, cycleClaimReportRepository);
    }

    @Test
    void reportRejectsMissingClaimWithoutSaving() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(cycleClaimRepository.findById(10L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> claimService.reportClaim(1L, 10L, ClaimReportCategory.ABUSE))
                .isInstanceOfSatisfying(ClaimException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXIST_CLAIM_ID));
        verifyNoInteractions(cycleClaimReportRepository);
    }
}
