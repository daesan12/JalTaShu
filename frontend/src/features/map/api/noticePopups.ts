import { apiGet } from '@/shared/api/client';

/**
 * 07-1 공지 팝업 한 장.
 *
 * 마이페이지 공지사항 목록(`/notices`)과는 **별개 데이터**다. 관리자 페이지에서 서로 다른
 * CRUD로 관리하고, 팝업 등록 시 "관련 공지사항 연결" 드롭다운으로 공지 하나를 연결할 수 있다.
 * 백엔드 API·경로 모두 미확정이라 msw 목업 기준 임시 스키마.
 */
export interface PopupNotice {
  id: number;
  /** 팝업에 띄울 이미지 */
  imageUrl: string;
  /** 관리자가 연결한 공지사항. 연결하지 않은 팝업은 null */
  linkedNoticeId: number | null;
}

export const NOTICE_POPUPS_QUERY_KEY = ['notice-popups'] as const;

export function getNoticePopups(): Promise<PopupNotice[]> {
  return apiGet<PopupNotice[]>('/notice-popups');
}
