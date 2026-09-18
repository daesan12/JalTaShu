package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu._util.service.S3Service;
import com.s15p21b103.good_tashu.admin.domain.AdminEntity;
import com.s15p21b103.good_tashu.admin.domain.PopupEntity;
import com.s15p21b103.good_tashu.admin.dto.req.AdminNoticeCreateRequest;
import com.s15p21b103.good_tashu.admin.dto.req.AdminNoticeUpdateRequest;
import com.s15p21b103.good_tashu.admin.repository.AdminRepository;
import com.s15p21b103.good_tashu.admin.repository.PopupRepository;
import com.s15p21b103.good_tashu.notice.domain.NoticeEntity;
import com.s15p21b103.good_tashu.notice.exception.NoticeException;
import com.s15p21b103.good_tashu.notice.repository.NoticeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static com.s15p21b103.good_tashu.notice.exception.NoticeErrorCode.NOTICE_HAS_POPUPS;

@ExtendWith(MockitoExtension.class)
class AdminNoticeServiceTest {
    @Mock AdminRepository adminRepository;
    @Mock NoticeRepository noticeRepository;
    @Mock PopupRepository popupRepository;
    @Mock S3Service s3Service;
    @InjectMocks AdminNoticeService adminNoticeService;

    @Test
    void createNoticeReturnsSavedId() {
        AdminEntity admin = AdminEntity.builder().adminId(1L).build();
        when(adminRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(noticeRepository.save(any(NoticeEntity.class))).thenAnswer(invocation -> {
            NoticeEntity notice = invocation.getArgument(0);
            assertThat(notice.getAdminEntity()).isSameAs(admin);
            assertThat(notice.getTitle()).isEqualTo("공지 제목");
            assertThat(notice.getContent()).isEqualTo("공지 내용");
            ReflectionTestUtils.setField(notice, "noticeId", 7L);
            return notice;
        });

        assertThat(adminNoticeService.createNotice(1L,
                new AdminNoticeCreateRequest(" 공지 제목 ", "공지 내용")).noticeId()).isEqualTo(7L);
    }

    @Test
    void updateNoticeChangesOnlyProvidedField() {
        NoticeEntity notice = NoticeEntity.builder().noticeId(7L).title("기존 제목").content("기존 내용").build();
        when(noticeRepository.findById(7L)).thenReturn(Optional.of(notice));

        assertThat(adminNoticeService.updateNotice(7L,
                new AdminNoticeUpdateRequest(" 새 제목 ", null)).noticeId()).isEqualTo(7L);
        assertThat(notice.getTitle()).isEqualTo("새 제목");
        assertThat(notice.getContent()).isEqualTo("기존 내용");
    }

    @Test
    void updateNoticeRejectsEmptyPatch() {
        assertThatThrownBy(() -> adminNoticeService.updateNotice(7L,
                new AdminNoticeUpdateRequest(null, null)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(noticeRepository, never()).findById(any());
    }

    @Test
    void deleteNoticeRejectsWhenPopupIsLinked() {
        NoticeEntity notice = NoticeEntity.builder().noticeId(2L).build();
        when(noticeRepository.findById(2L)).thenReturn(Optional.of(notice));
        when(popupRepository.existsByNotice_NoticeId(2L)).thenReturn(true);

        assertThatThrownBy(() -> adminNoticeService.deleteNotice(2L))
                .isInstanceOfSatisfying(NoticeException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOTICE_HAS_POPUPS));
        verify(noticeRepository, never()).delete(any());
    }

    @Test
    void deleteNoticeRemovesUnlinkedNotice() {
        NoticeEntity notice = NoticeEntity.builder().noticeId(2L).build();
        when(noticeRepository.findById(2L)).thenReturn(Optional.of(notice));

        adminNoticeService.deleteNotice(2L);

        verify(noticeRepository).delete(notice);
    }

    @Test
    void createPopupReturnsSavedId() {
        MockMultipartFile photo = new MockMultipartFile("photo", "popup.png", "image/png", new byte[]{1});
        AdminEntity admin = AdminEntity.builder().adminId(1L).build();
        NoticeEntity notice = NoticeEntity.builder().noticeId(2L).build();
        when(adminRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(noticeRepository.findById(2L)).thenReturn(Optional.of(notice));
        when(s3Service.uploadImage(photo)).thenReturn("images/photo-key");
        when(popupRepository.save(any(PopupEntity.class))).thenAnswer(invocation -> {
            PopupEntity popup = invocation.getArgument(0);
            assertThat(popup.getTitle()).isEqualTo("팝업 제목");
            assertThat(popup.getPhotoUrl()).isEqualTo("images/photo-key");
            assertThat(popup.getNotice()).isSameAs(notice);
            assertThat(popup.getAdmin()).isSameAs(admin);
            ReflectionTestUtils.setField(popup, "popUpId", 3L);
            return popup;
        });

        assertThat(adminNoticeService.createPopup(1L, " 팝업 제목 ", photo, 2L).popupId())
                .isEqualTo(3L);
    }

    @Test
    void missingNoticeDoesNotUploadPhoto() {
        MockMultipartFile photo = new MockMultipartFile("photo", "popup.png", "image/png", new byte[]{1});
        when(adminRepository.findById(1L)).thenReturn(Optional.of(AdminEntity.builder().adminId(1L).build()));
        when(noticeRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminNoticeService.createPopup(1L, "제목", photo, 99L))
                .isInstanceOf(NoticeException.class);
        verify(s3Service, never()).uploadImage(any());
    }

    @Test
    void createPopupRemovesUploadedPhotoOnRollback() {
        MockMultipartFile photo = new MockMultipartFile("photo", "popup.png", "image/png", new byte[]{1});
        when(adminRepository.findById(1L)).thenReturn(Optional.of(AdminEntity.builder().adminId(1L).build()));
        when(noticeRepository.findById(2L)).thenReturn(Optional.of(NoticeEntity.builder().noticeId(2L).build()));
        when(s3Service.uploadImage(photo)).thenReturn("images/photo-key");
        when(popupRepository.save(any(PopupEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TransactionSynchronizationManager.initSynchronization();
        try {
            adminNoticeService.createPopup(1L, "제목", photo, 2L);
            verify(s3Service, never()).deleteImage(any());

            for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
                synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
            }
            verify(s3Service).deleteImage("images/photo-key");
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void updatePopupChangesOnlyProvidedFields() {
        NoticeEntity originalNotice = NoticeEntity.builder().noticeId(2L).build();
        NoticeEntity newNotice = NoticeEntity.builder().noticeId(4L).build();
        PopupEntity popup = new PopupEntity("기존 제목", "images/old", originalNotice,
                AdminEntity.builder().adminId(1L).build());
        ReflectionTestUtils.setField(popup, "popUpId", 3L);
        when(popupRepository.findById(3L)).thenReturn(Optional.of(popup));
        when(noticeRepository.findById(4L)).thenReturn(Optional.of(newNotice));

        assertThat(adminNoticeService.updatePopup(3L, " 새 제목 ", null, 4L).popupId()).isEqualTo(3L);
        assertThat(popup.getTitle()).isEqualTo("새 제목");
        assertThat(popup.getNotice()).isSameAs(newNotice);
        assertThat(popup.getPhotoUrl()).isEqualTo("images/old");
        verify(s3Service, never()).uploadImage(any());
    }

    @Test
    void updatePopupReplacesPhotoAfterCommit() {
        MockMultipartFile photo = new MockMultipartFile("photo", "new.png", "image/png", new byte[]{1});
        PopupEntity popup = new PopupEntity("제목", "images/old",
                NoticeEntity.builder().noticeId(2L).build(), AdminEntity.builder().adminId(1L).build());
        ReflectionTestUtils.setField(popup, "popUpId", 3L);
        when(popupRepository.findById(3L)).thenReturn(Optional.of(popup));
        when(s3Service.uploadImage(photo)).thenReturn("images/new");

        TransactionSynchronizationManager.initSynchronization();
        try {
            assertThat(adminNoticeService.updatePopup(3L, null, photo, null).popupId()).isEqualTo(3L);
            assertThat(popup.getPhotoUrl()).isEqualTo("images/new");
            verify(s3Service, never()).deleteImage(any());

            for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
                synchronization.afterCommit();
            }
            verify(s3Service).deleteImage("images/old");
            verify(s3Service, never()).deleteImage("images/new");
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void updatePopupKeepsOldPhotoOnRollback() {
        MockMultipartFile photo = new MockMultipartFile("photo", "new.png", "image/png", new byte[]{1});
        PopupEntity popup = new PopupEntity("제목", "images/old",
                NoticeEntity.builder().noticeId(2L).build(), AdminEntity.builder().adminId(1L).build());
        when(popupRepository.findById(3L)).thenReturn(Optional.of(popup));
        when(s3Service.uploadImage(photo)).thenReturn("images/new");

        TransactionSynchronizationManager.initSynchronization();
        try {
            adminNoticeService.updatePopup(3L, null, photo, null);
            for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
                synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
            }
            verify(s3Service).deleteImage("images/new");
            verify(s3Service, never()).deleteImage("images/old");
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void deletePopupRemovesPhotoOnlyAfterCommit() {
        PopupEntity popup = new PopupEntity("제목", "images/photo-key",
                NoticeEntity.builder().noticeId(2L).build(), AdminEntity.builder().adminId(1L).build());
        when(popupRepository.findById(3L)).thenReturn(Optional.of(popup));
        TransactionSynchronizationManager.initSynchronization();
        try {
            adminNoticeService.deletePopup(3L);
            verify(popupRepository).delete(popup);
            verify(s3Service, never()).deleteImage(any());

            for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
                synchronization.afterCommit();
            }
            verify(s3Service).deleteImage("images/photo-key");
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }
}
