import { apiGet, apiPatch } from '@/shared/api/client';

/**
 * 03 제보 관리 — API 3종 전부 백엔드 미구현이라 msw 목업 기준 임시 스키마.
 * 화면 이름은 "제보"지만 API 용어는 claim (신고=report는 허위 제보 신고, 별개 기능).
 * 401은 관리자 가드가 처리(skipAuthRedirect).
 */

/** 서버 enum — 한글 라벨로 바꾸는 건 화면에서 한다 (AdminBadge 규칙) */
export type ClaimStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, '미해결' | '처리중' | '해결됨'> = {
  OPEN: '미해결',
  IN_PROGRESS: '처리중',
  RESOLVED: '해결됨',
};

export interface AdminClaim {
  claimId: number;
  cycleId: string;
  /** 제보자 닉네임 */
  nickname: string;
  /** 고장 부위 태그 (모바일 제보와 같은 분류) */
  tag: string;
  content: string;
  statement: ClaimStatus;
  /** 관리자 처리 내용 (PATCH의 content) */
  adminContent: string | null;
  /** 이 제보에 달린 허위 제보 신고 수 */
  reportCnt: number;
  createdAt: string;
}

/**
 * 목록 — 명세의 필터 파라미터(nickname·cycleId·order·status)는 백엔드 미구현이라
 * 전체를 받아 클라이언트에서 거른다 (연동 시 서버 필터로 교체).
 */
export function getAdminClaims(): Promise<AdminClaim[]> {
  return apiGet<AdminClaim[]>('/admin/cycle/claim', { skipAuthRedirect: true });
}

/** PATCH /admin/cycle/claim/{claimId} — 처리 상태·처리 내용 변경 */
export function updateAdminClaim(
  claimId: number,
  input: { statement: ClaimStatus; content: string },
): Promise<AdminClaim> {
  return apiPatch<AdminClaim>(`/admin/cycle/claim/${claimId}`, input, {
    skipAuthRedirect: true,
  });
}
