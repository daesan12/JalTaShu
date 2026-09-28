import { apiGet, apiPatch } from '@/shared/api/client';

/**
 * 03 제보 관리 — 백엔드 실구현(AdminCycleController) 스키마.
 * 화면 이름은 "제보"지만 API 용어는 claim (신고=report는 허위 제보 신고, 별개 기능).
 * 401은 관리자 가드가 처리(skipAuthRedirect).
 */

/** 서버 enum(ClaimStatus 실측) — 한글 라벨로 바꾸는 건 화면에서 한다 (AdminBadge 규칙) */
export type ClaimStatus = 'READY' | 'IN_PROGRESS' | 'COMPLETED';

/** 통계 카드·필터·처리 상태 선택지의 순서 */
export const CLAIM_STATUS_ORDER: ClaimStatus[] = ['READY', 'IN_PROGRESS', 'COMPLETED'];

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, '미해결' | '처리중' | '해결됨'> = {
  READY: '미해결',
  IN_PROGRESS: '처리중',
  COMPLETED: '해결됨',
};

/** 민원 유형(ClaimType 실측) — 고장 / 방치 / 기타 문의 */
export type ClaimType = 'CYCLE' | 'ABANDONED' | 'ETC';

export const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  CYCLE: '고장',
  ABANDONED: '방치',
  ETC: '기타',
};

/** 서버 enum(ClaimCategory 실측) — 고장 부위 */
export type ClaimCategory = 'BREAK' | 'TIRE' | 'SADDLE' | 'CHAIN' | 'FRAME' | 'ETC';

export const CLAIM_CATEGORY_LABEL: Record<ClaimCategory, string> = {
  BREAK: '브레이크',
  TIRE: '타이어',
  SADDLE: '안장',
  CHAIN: '체인',
  FRAME: '프레임',
  ETC: '기타',
};

/** 목록 한 건 (AdminClaimListResponse 실측) */
export interface AdminClaim {
  claimId: number;
  claimType: ClaimType;
  /** 기타 문의는 자전거와 무관해 null */
  cycleId: string | null;
  content: string;
  /** 고장(CYCLE)에만 있다 — 방치·기타는 부위가 없어 null */
  category: ClaimCategory | null;
  /** 제보자 — 가입을 끝내지 않은 사용자는 닉네임이 없다 (claims.user_id는 not null이라 userId는 항상 있다) */
  nickname: string | null;
  userId: number;
  createdAt: string;
  /** 이 제보에 달린 허위 제보 신고 수 */
  cycleReportNum: number;
  status: ClaimStatus;
  /** 관리자 처리 내용이 있는지 — 내용 자체는 상세 API로 받는다 */
  hasComment: boolean;
}

/** 상세에 붙는 허위 제보 신고 한 건 */
export interface AdminClaimReport {
  reportId: number;
  reportCategory: 'FALSE_INFORMATION' | 'PRANK_REPORT' | 'ABUSE' | 'ETC';
  createdAt: string;
  userId: number;
  /** 가입을 끝내지 않은 사용자는 닉네임이 없다 */
  nickname: string | null;
}

/** 상세 (AdminClaimDetailResponse 실측) — 목록에 없는 처리 내용·사진·신고 내역이 온다 */
export interface AdminClaimDetail {
  claimId: number;
  claimType: ClaimType;
  cycleId: string | null;
  userId: number;
  /** 가입을 끝내지 않은 사용자는 닉네임이 없다 */
  nickname: string | null;
  createdAt: string;
  content: string;
  statement: ClaimStatus;
  adminComment: string | null;
  photoUrl: string | null;
  report: AdminClaimReport[];
}

/**
 * 목록 — 서버 필터(nickname·cycleId·order·status)가 있지만 화면 검색은
 * "닉네임 또는 자전거 ID" 한 칸이라 전체를 받아 클라이언트에서 거른다.
 */
export function getAdminClaims(): Promise<AdminClaim[]> {
  return apiGet<AdminClaim[]>('/admin/claim/list', { skipAuthRedirect: true });
}

/** GET /admin/claim/{claimId} — 상세 모달용 */
export function getAdminClaimDetail(claimId: number): Promise<AdminClaimDetail> {
  return apiGet<AdminClaimDetail>(`/admin/claim/${claimId}`, { skipAuthRedirect: true });
}

/** PATCH /admin/claim/{claimId} — 처리 상태·처리 내용(≤255자) 변경. 응답은 claimId뿐 */
export function updateAdminClaim(
  claimId: number,
  input: { statement: ClaimStatus; content: string },
): Promise<{ claimId: number }> {
  return apiPatch<{ claimId: number }>(`/admin/claim/${claimId}`, input, {
    skipAuthRedirect: true,
  });
}
