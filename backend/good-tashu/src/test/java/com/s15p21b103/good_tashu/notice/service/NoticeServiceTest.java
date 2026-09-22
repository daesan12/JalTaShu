package com.s15p21b103.good_tashu.notice.service;

import com.s15p21b103.good_tashu._util.service.S3Service;
import com.s15p21b103.good_tashu.admin.domain.AdminEntity;
import com.s15p21b103.good_tashu.admin.domain.PopupEntity;
import com.s15p21b103.good_tashu.admin.repository.PopupRepository;
import com.s15p21b103.good_tashu.notice.domain.NoticeEntity;
import com.s15p21b103.good_tashu.notice.dto.res.NoticeListResponse;
import com.s15p21b103.good_tashu.notice.exception.NoticeException;
import com.s15p21b103.good_tashu.notice.repository.NoticeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static com.s15p21b103.good_tashu.notice.exception.NoticeErrorCode.NOT_EXIST_NOTICE_ID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NoticeServiceTest {
    @Mock NoticeRepository noticeRepository;
    @Mock PopupRepository popupRepository;
    @Mock S3Service s3Service;
    @InjectMocks NoticeService noticeService;

    private final LocalDateTime createdAt = LocalDateTime.of(2026, 9, 10, 10, 0);

    private NoticeEntity notice(Long id) {
        return NoticeEntity.builder()
                .noticeId(id)
                .adminEntity(AdminEntity.builder().id("admin01").password("not-returned").build())
                .title("공지 제목")
                .content("공지 내용")
                .createdAt(createdAt)
                .build();
    }

    @Test
    void popupListReturnsSignedPhotoUrlsAndLinkedNoticeIds() {
        PopupEntity popup = new PopupEntity("팝업 제목", "images/photo-key", notice(7L),
                AdminEntity.builder().id("admin01").build());
        ReflectionTestUtils.setField(popup, "popUpId", 3L);
        when(popupRepository.findAllByOrderByCreatedAtDescPopUpIdDesc()).thenReturn(List.of(popup));
        when(s3Service.createDownloadUrl("images/photo-key"))
                .thenReturn("https://example.com/signed-photo");

        var result = noticeService.getPopupList();

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().popupId()).isEqualTo(3L);
        assertThat(result.getFirst().title()).isEqualTo("팝업 제목");
        assertThat(result.getFirst().photoUrl()).isEqualTo("https://example.com/signed-photo");
        assertThat(result.getFirst().noticeId()).isEqualTo(7L);
        verify(s3Service).createDownloadUrl("images/photo-key");
    }

    @Test
    void listMapsOnlyResponseFieldsAndPreservesRepositoryOrder() {
        when(noticeRepository.findAllByOrderByCreatedAtDescNoticeIdDesc())
                .thenReturn(List.of(notice(2L), notice(1L)));

        assertThat(noticeService.getNoticeList()).containsExactly(
                new NoticeListResponse(2L, "공지 제목", "admin01", createdAt),
                new NoticeListResponse(1L, "공지 제목", "admin01", createdAt));
        verify(noticeRepository, never()).incrementViewCount(anyLong());
    }

    @Test
    void listReturnsEmptyListWhenNoNoticesExist() {
        when(noticeRepository.findAllByOrderByCreatedAtDescNoticeIdDesc()).thenReturn(List.of());
        assertThat(noticeService.getNoticeList()).isEmpty();
    }

    @Test
    void detailIncrementsViewCountAndReturnsContent() {
        when(noticeRepository.incrementViewCount(1L)).thenReturn(1);
        when(noticeRepository.findById(1L)).thenReturn(Optional.of(notice(1L)));

        var response = noticeService.getNoticeDetail(1L);

        assertThat(response.title()).isEqualTo("공지 제목");
        assertThat(response.author()).isEqualTo("admin01");
        assertThat(response.content()).isEqualTo("공지 내용");
        assertThat(response.createdAt()).isEqualTo(createdAt);
        verify(noticeRepository, times(1)).incrementViewCount(1L);
    }

    @Test
    void missingNoticeRaisesDomainErrorWithoutReadingDetail() {
        when(noticeRepository.incrementViewCount(99L)).thenReturn(0);

        assertThatThrownBy(() -> noticeService.getNoticeDetail(99L))
                .isInstanceOfSatisfying(NoticeException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXIST_NOTICE_ID));
        verify(noticeRepository, never()).findById(anyLong());
    }

    @Test
    void missingDetailAfterUpdateStillRaisesDomainError() {
        when(noticeRepository.incrementViewCount(1L)).thenReturn(1);
        when(noticeRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> noticeService.getNoticeDetail(1L))
                .isInstanceOfSatisfying(NoticeException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(NOT_EXIST_NOTICE_ID));
    }
}
