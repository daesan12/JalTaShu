import { apiGet } from '@/shared/api/client';

/**
 * 07-1 공지 팝업 한 장 — 백엔드 `PopupListResponse` 실측 스키마.
 *
 * 마이페이지 공지사항 목록(`/notice/list`)과는 **별개 데이터**다. 관리자가 팝업을 따로 등록하고,
 * 등록할 때 공지 하나를 반드시 연결한다(백엔드 `PopupEntity.notice`가 not null).
 */
export interface PopupNotice {
  /** 팝업 제목 — 화면에는 이미지만 보이므로 이미지 대체 텍스트로 쓴다 */
  title: string;
  /** 팝업에 띄울 이미지 (S3 다운로드 URL) */
  photoUrl: string;
  /** 눌렀을 때 열 공지. 팝업은 항상 공지에 연결돼 있다 */
  noticeId: number;
}

export const NOTICE_POPUPS_QUERY_KEY = ['notice', 'pop-up'] as const;

/** 07-1 공지 팝업 목록 — 백엔드 `GET /notice/pop-up` (최신 등록순) */
export function getNoticePopups(): Promise<PopupNotice[]> {
  return apiGet<PopupNotice[]>('/notice/pop-up');
}
