import { apiDelete, apiGet, apiPost } from '@/shared/api/client';

/** 제목·내용 글자 수 상한 (Figma 08의 0/60·0/2000 카운터) */
export const NOTICE_TITLE_MAX = 60;
export const NOTICE_CONTENT_MAX = 2000;

/**
 * 06·08 공지사항 — 목록·상세는 백엔드 실구현(NoticeController) 스키마,
 * 등록·삭제는 구현 X라 msw 목업 기준(전달 목록). 401은 관리자 가드가 처리(skipAuthRedirect).
 */

/** 목록 한 건 (NoticeListResponse 실측) — 본문은 상세에만 있다 */
export interface AdminNoticeSummary {
  noticeId: number;
  title: string;
  author: string;
  createdAt: string;
}

/** 상세 (NoticeDetailResponse 실측) */
export interface AdminNoticeDetail {
  title: string;
  author: string;
  createdAt: string;
  content: string;
}

export function getAdminNotices(): Promise<AdminNoticeSummary[]> {
  return apiGet<AdminNoticeSummary[]>('/notice/list', { skipAuthRedirect: true });
}

export function getAdminNotice(noticeId: number): Promise<AdminNoticeDetail> {
  return apiGet<AdminNoticeDetail>(`/notice/${noticeId}`, { skipAuthRedirect: true });
}

/** POST /admin/notice — 백엔드 미구현, msw 목업 기준 임시 스키마 */
export function createAdminNotice(input: { title: string; content: string }): Promise<unknown> {
  return apiPost<unknown>('/admin/notice', input, { skipAuthRedirect: true });
}

/** DELETE /admin/notice/{id} — 백엔드 미구현, msw 목업 기준 임시 스키마 */
export function deleteAdminNotice(noticeId: number): Promise<null> {
  return apiDelete<null>(`/admin/notice/${noticeId}`, { skipAuthRedirect: true });
}
