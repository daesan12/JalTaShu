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
