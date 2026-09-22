package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu._util.service.S3Service;
import com.s15p21b103.good_tashu.admin.domain.AdminEntity;
import com.s15p21b103.good_tashu.admin.domain.PopupEntity;
import com.s15p21b103.good_tashu.admin.dto.req.AdminNoticeCreateRequest;
import com.s15p21b103.good_tashu.admin.dto.req.AdminNoticeUpdateRequest;
import com.s15p21b103.good_tashu.admin.dto.res.AdminNoticeCreateResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminNoticeListResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminPopupCreateResponse;
import com.s15p21b103.good_tashu.admin.exception.AdminException;
import com.s15p21b103.good_tashu.admin.repository.AdminRepository;
import com.s15p21b103.good_tashu.admin.repository.PopupRepository;
import com.s15p21b103.good_tashu.notice.domain.NoticeEntity;
import com.s15p21b103.good_tashu.notice.exception.NoticeException;
import com.s15p21b103.good_tashu.notice.repository.NoticeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.NOT_EXISTS_ADMIN;
import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.NOT_EXISTS_POPUP;
import static com.s15p21b103.good_tashu.notice.exception.NoticeErrorCode.NOT_EXIST_NOTICE_ID;
import static com.s15p21b103.good_tashu.notice.exception.NoticeErrorCode.NOTICE_HAS_POPUPS;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminNoticeService {
    private final AdminRepository adminRepository;
    private final NoticeRepository noticeRepository;
    private final PopupRepository popupRepository;
    private final S3Service s3Service;

    @Transactional(readOnly = true)
    public List<AdminNoticeListResponse> getNoticeList() {
        return popupRepository.findAdminNoticeList();
    }

    @Transactional
    public AdminNoticeCreateResponse createNotice(Long adminId, AdminNoticeCreateRequest request) {
        AdminEntity admin = adminRepository.findById(adminId)
                .orElseThrow(() -> new AdminException(NOT_EXISTS_ADMIN));
        NoticeEntity notice = NoticeEntity.builder()
                .adminEntity(admin)
                .title(request.title().strip())
                .content(request.content())
                .build();
        return new AdminNoticeCreateResponse(noticeRepository.save(notice).getNoticeId());
    }

    @Transactional
    public AdminNoticeCreateResponse updateNotice(Long noticeId, AdminNoticeUpdateRequest request) {
        if (request.title() == null && request.content() == null) {
            throw new IllegalArgumentException("수정할 공지사항 항목을 입력해주세요.");
        }
        if (request.title() != null &&
                (request.title().isBlank() || request.title().strip().length() > 100)) {
            throw new IllegalArgumentException("공지사항 제목은 1~100자로 입력해주세요.");
        }
        if (request.content() != null && request.content().isBlank()) {
            throw new IllegalArgumentException("공지사항 내용을 입력해주세요.");
        }

        NoticeEntity notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new NoticeException(NOT_EXIST_NOTICE_ID));
        if (request.title() != null) {
            notice.updateTitle(request.title().strip());
        }
        if (request.content() != null) {
            notice.updateContent(request.content());
        }
        return new AdminNoticeCreateResponse(notice.getNoticeId());
    }

    @Transactional
    public void deleteNotice(Long noticeId) {
        NoticeEntity notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new NoticeException(NOT_EXIST_NOTICE_ID));
        if (popupRepository.existsByNotice_NoticeId(noticeId)) {
            throw new NoticeException(NOTICE_HAS_POPUPS);
        }
        noticeRepository.delete(notice);
    }

    @Transactional
    public AdminPopupCreateResponse createPopup(Long adminId, String title,
                                                 MultipartFile photo, Long noticeId) {
        if (title == null || title.isBlank() || title.strip().length() > 255) {
            throw new IllegalArgumentException("팝업 제목은 1~255자로 입력해주세요.");
        }

        AdminEntity admin = adminRepository.findById(adminId)
                .orElseThrow(() -> new AdminException(NOT_EXISTS_ADMIN));
        NoticeEntity notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new NoticeException(NOT_EXIST_NOTICE_ID));

        String photoKey = s3Service.uploadImage(photo);
        // DB 트랜잭션이 실패하면 먼저 업로드한 사진을 정리한다.
        deleteNewPhotoOnRollback(photoKey);
        PopupEntity popup = popupRepository.save(new PopupEntity(title.strip(), photoKey, notice, admin));
        return new AdminPopupCreateResponse(popup.getPopUpId());
    }

    @Transactional
    public AdminPopupCreateResponse updatePopup(Long popupId, String title,
                                                MultipartFile photo, Long noticeId) {
        if (title == null && photo == null && noticeId == null) {
            throw new IllegalArgumentException("수정할 팝업 항목을 입력해주세요.");
        }
        if (title != null && (title.isBlank() || title.strip().length() > 255)) {
            throw new IllegalArgumentException("팝업 제목은 1~255자로 입력해주세요.");
        }
        if (photo != null && photo.isEmpty()) {
            throw new IllegalArgumentException("수정할 사진이 비어 있습니다.");
        }

        PopupEntity popup = popupRepository.findById(popupId)
                .orElseThrow(() -> new AdminException(NOT_EXISTS_POPUP));
        NoticeEntity notice = null;
        if (noticeId != null) {
            notice = noticeRepository.findById(noticeId)
                    .orElseThrow(() -> new NoticeException(NOT_EXIST_NOTICE_ID));
        }

        if (photo != null) {
            String previousPhotoKey = popup.getPhotoUrl();
            String newPhotoKey = s3Service.uploadImage(photo);
            deleteNewPhotoOnRollback(newPhotoKey);
            deleteOldPhotoAfterCommit(previousPhotoKey);
            popup.updatePhotoUrl(newPhotoKey);
        }
        if (title != null) {
            popup.updateTitle(title.strip());
        }
        if (notice != null) {
            popup.updateNotice(notice);
        }
        return new AdminPopupCreateResponse(popup.getPopUpId());
    }

    @Transactional
    public void deletePopup(Long popUpId) {
        PopupEntity popup = popupRepository.findById(popUpId)
                .orElseThrow(() -> new AdminException(NOT_EXISTS_POPUP));
        String photoKey = popup.getPhotoUrl();
        popupRepository.delete(popup);

        // DB 삭제가 확정된 뒤에만 S3 객체를 삭제한다.
        deleteOldPhotoAfterCommit(photoKey);
    }

    private void deleteNewPhotoOnRollback(String key) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status == STATUS_ROLLED_BACK) {
                        deleteImageSafely(key);
                    }
                }
            });
        }
    }

    private void deleteOldPhotoAfterCommit(String key) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deleteImageSafely(key);
                }
            });
        }
    }

    private void deleteImageSafely(String key) {
        try {
            s3Service.deleteImage(key);
        } catch (Exception e) {
            log.error("팝업 사진 정리 실패: key={}", key, e);
        }
    }
}
