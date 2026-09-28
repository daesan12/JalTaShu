import { apiGet } from '@/shared/api/client';

/** 공지 한 건 (NoticeListResponse 실측) — 본문은 상세 API(/notice/{id})에만 있다 */
export interface Notice {
  noticeId: number;
  title: string;
  author: string;
  createdAt: string;
}

/** GET /api/notice/list — 관리자 웹과 같은 API를 쓴다 (관리자가 등록하면 여기에도 뜬다) */
export function getNotices(): Promise<Notice[]> {
  return apiGet<Notice[]>('/notice/list');
}

/** 공지 상세 (NoticeDetailResponse 실측) — 목록과 달리 noticeId가 없고 본문이 있다 */
export interface NoticeDetail {
  title: string;
  author: string;
  createdAt: string;
  content: string;
}

/** GET /api/notice/{noticeId} */
export function getNotice(noticeId: number): Promise<NoticeDetail> {
  return apiGet<NoticeDetail>(`/notice/${noticeId}`);
}
