import { apiDelete, apiGet, apiPost } from '@/shared/api/client';

/** 제목·내용 글자 수 상한 (Figma 08의 0/60·0/2000 카운터) */
export const NOTICE_TITLE_MAX = 60;
export const NOTICE_CONTENT_MAX = 2000;

/**
 * 06·08 공지사항 — 목록·상세는 API 명세 구현 O(응답 형태는 임시), 등록·삭제는 구현 X라
 * msw 목업 기준. 401은 관리자 가드가 처리(skipAuthRedirect).
 */
export interface AdminNotice {
  noticeId: number;
  title: string;
  content: string;
  createdAt: string;
}

export function getAdminNotices(): Promise<AdminNotice[]> {
  return apiGet<AdminNotice[]>('/notice/list', { skipAuthRedirect: true });
}

export function getAdminNotice(noticeId: number): Promise<AdminNotice> {
  return apiGet<AdminNotice>(`/notice/${noticeId}`, { skipAuthRedirect: true });
}

export function createAdminNotice(input: { title: string; content: string }): Promise<AdminNotice> {
  return apiPost<AdminNotice>('/admin/notice', input, { skipAuthRedirect: true });
}

export function deleteAdminNotice(noticeId: number): Promise<null> {
  return apiDelete<null>(`/admin/notice/${noticeId}`, { skipAuthRedirect: true });
}
