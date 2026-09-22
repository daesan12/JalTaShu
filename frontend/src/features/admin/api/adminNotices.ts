import { apiDelete, apiGet, apiPost } from '@/shared/api/client';

/** 제목·내용 글자 수 상한 (Figma 08의 0/60·0/2000 카운터) */
export const NOTICE_TITLE_MAX = 60;
export const NOTICE_CONTENT_MAX = 2000;

/**
 * 06·08 공지사항 — 목록·상세는 관리자 전용 API(AdminNoticeController) 실구현,
 * 등록·삭제는 구현 X라 msw 목업 기준(전달 목록). 401은 관리자 가드가 처리(skipAuthRedirect).
 */

/** 목록 한 건 (NoticeListResponse 실측) — 본문은 상세에만 있다 */
export interface AdminNoticeSummary {
  noticeId: number;
  title: string;
  author: string;
  createdAt: string;
  popupId: number | null;
}

/** 상세 (NoticeDetailResponse 실측) */
export interface AdminNoticeDetail {
  title: string;
  author: string;
  createdAt: string;
  content: string;
}

/** GET /admin/notice/list — 관리자 전용 목록 (응답 스키마는 NoticeListResponse 그대로) */
export function getAdminNotices(): Promise<AdminNoticeSummary[]> {
  return apiGet<AdminNoticeSummary[]>('/admin/notice/list', { skipAuthRedirect: true });
}

/** GET /admin/notice/{id} — 관리자 전용 상세 (응답 스키마는 NoticeDetailResponse 그대로) */
export function getAdminNotice(noticeId: number): Promise<AdminNoticeDetail> {
  return apiGet<AdminNoticeDetail>(`/admin/notice/${noticeId}`, { skipAuthRedirect: true });
}

/** POST /admin/notice — 백엔드 미구현, msw 목업 기준 임시 스키마 */
export function createAdminNotice(input: { title: string; content: string }): Promise<unknown> {
  return apiPost<unknown>('/admin/notice', input, { skipAuthRedirect: true });
}

/** DELETE /admin/notice/{id} — 백엔드 미구현, msw 목업 기준 임시 스키마 */
export function deleteAdminNotice(noticeId: number): Promise<null> {
  return apiDelete<null>(`/admin/notice/${noticeId}`, { skipAuthRedirect: true });
}

/*
 * 핀(공지 팝업) — 공지 하나를 앱 첫 화면 팝업으로 띄운다.
 *
 * 백엔드는 팝업을 **공지에 딸린 레코드**로 본다(`PopupEntity.notice`가 not null). 그래서 핀 켜기는
 * 팝업 등록(POST), 핀 끄기는 팝업 삭제(DELETE)다. 팝업은 이미지가 필수라 핀을 켤 때 파일을 받는다.
 */

/**
 * 핀 상태는 **공지 목록의 `popupId`**로 읽는다(`AdminNoticeSummary`). null이면 꺼짐, 값이 있으면
 * 켜짐이고 그 값이 해제에 쓸 id다. 목록 한 번으로 전부 알 수 있어 팝업 목록을 따로 부르지 않는다.
 * (관리자 전용 `GET /admin/pop-up`도 있지만 이 화면에는 필요 없다.)
 *
 * 동시에 핀할 수 있는 공지 수.
 * 앱 팝업이 좌우로 넘기는 캐러셀이라 장수가 늘수록 끝까지 보는 사람이 줄어든다.
 * **프론트에서만 막는다** — 백엔드에 개수 검증이 없어 두 관리자가 동시에 켜면 넘을 수 있지만,
 * 관리자 수가 적어 실질적인 위험이 낮다고 보고 백엔드 변경을 미뤘다.
 */
export const MAX_PINNED_NOTICES = 5;

/** POST /admin/pop-up — 핀 켜기. 파라미터 이름은 백엔드 `createPopup` 실측(title·photo·noticeId) */
export function pinNotice(input: {
  noticeId: number;
  title: string;
  photo: File;
}): Promise<unknown> {
  const form = new FormData();
  form.append('title', input.title);
  form.append('photo', input.photo);
  form.append('noticeId', String(input.noticeId));
  // Content-Type을 직접 넣지 않는다 — axios가 boundary까지 붙여야 서버가 파싱한다
  return apiPost<unknown>('/admin/pop-up', form, { skipAuthRedirect: true });
}

/** DELETE /admin/pop-up/{popupId} — 핀 끄기 */
export function unpinNotice(popupId: number): Promise<null> {
  return apiDelete<null>(`/admin/pop-up/${popupId}`, { skipAuthRedirect: true });
}
