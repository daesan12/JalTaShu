package com.s15p21b103.good_tashu.notice.service;

import com.s15p21b103.good_tashu._util.service.S3Service;
import com.s15p21b103.good_tashu.admin.repository.PopupRepository;
import com.s15p21b103.good_tashu.notice.domain.NoticeEntity;
import com.s15p21b103.good_tashu.notice.dto.res.NoticeDetailResponse;
import com.s15p21b103.good_tashu.notice.dto.res.NoticeListResponse;
import com.s15p21b103.good_tashu.notice.dto.res.PopupListResponse;
import com.s15p21b103.good_tashu.notice.exception.NoticeException;
import com.s15p21b103.good_tashu.notice.repository.NoticeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static com.s15p21b103.good_tashu.notice.exception.NoticeErrorCode.NOT_EXIST_NOTICE_ID;

@Service
@RequiredArgsConstructor
public class NoticeService {
    private final NoticeRepository noticeRepository;
    private final PopupRepository popupRepository;
    private final S3Service s3Service;

    @Transactional(readOnly = true)
    public List<PopupListResponse> getPopupList() {
        return popupRepository.findAllByOrderByCreatedAtDescPopUpIdDesc().stream()
                .map(popup -> new PopupListResponse(
                        popup.getTitle(),
                        s3Service.createDownloadUrl(popup.getPhotoUrl()),
                        popup.getNotice().getNoticeId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<NoticeListResponse> getNoticeList() {
        return noticeRepository.findAllByOrderByCreatedAtDescNoticeIdDesc().stream()
                .map(notice -> new NoticeListResponse(
                        notice.getNoticeId(),
                        notice.getTitle(),
                        notice.getAdminEntity().getId(),
                        notice.getCreatedAt()))
                .toList();
    }

    @Transactional
    public NoticeDetailResponse getNoticeDetail(Long noticeId) {
        if (noticeRepository.incrementViewCount(noticeId) == 0) {
            throw new NoticeException(NOT_EXIST_NOTICE_ID);
        }

        NoticeEntity notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new NoticeException(NOT_EXIST_NOTICE_ID));

        return new NoticeDetailResponse(
                notice.getTitle(),
                notice.getAdminEntity().getId(),
                notice.getCreatedAt(),
                notice.getContent());
    }
}
