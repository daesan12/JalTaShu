import { apiGet } from '@/shared/api/client';
import type { AdminClaim } from '@/features/admin/api/adminClaims';

/**
 * 05·07 자전거 관리 — 백엔드 실구현(AdminCycleController) 스키마.
 * 401은 관리자 가드가 처리(skipAuthRedirect).
 */

/** 서버 enum(CycleStatus 실측) — 정지 개념은 없고 대기중/대여중뿐이다 */
export type CycleStatus = 'READY' | 'RENTING';

export const CYCLE_STATUS_LABEL: Record<CycleStatus, '대기중' | '대여중'> = {
  READY: '대기중',
  RENTING: '대여중',
};

/** 목록 한 대 (AdminCycleListResponse 실측) */
export interface AdminCycleSummary {
  cycleId: string;
  /** 현재 위치(대여소명) — 대여 중이면 비어 있을 수 있다 */
  currentLocation: string | null;
  statement: CycleStatus;
  recentUsingAt: string | null;
  /** 달린 제보 수 */
  claimCnt: number;
}

/** GET /admin/cycle/statics — 목록 상단 통계 카드 (AdminCycleStatisticsResponse 실측) */
export interface AdminCycleStatics {
  totalCycleCnt: number;
  rentCycleCnt: number;
  waitCycleCnt: number;
  /** 제보가 달린 자전거 수 */
  claimCycleCnt: number;
}

/** 이용 이력 한 건 (AdminCycleHistoryResponse 실측) — 거리·시간은 응답에 없다 */
export interface AdminCycleHistory {
  recordId: number;
  usingAt: string;
  startingPoint: string;
  endPoint: string;
  userId: number;
  nickname: string;
}

/** GET /admin/cycle/{cycleId}/statics (AdminCycleDetailStatisticsResponse 실측) */
export interface AdminCycleOwnStatics {
  usingCnt: number;
  recentUsingAt: string | null;
  unresolvedClaim: number;
  registeredAt: string;
}

/** 서버 필터(cycle·stationName·statement·hasClaim)가 있지만 화면은 클라 필터를 유지한다 */
export function getAdminCycles(): Promise<AdminCycleSummary[]> {
  return apiGet<AdminCycleSummary[]>('/admin/cycle/list', { skipAuthRedirect: true });
}

export function getAdminCycleStatics(): Promise<AdminCycleStatics> {
  return apiGet<AdminCycleStatics>('/admin/cycle/statics', { skipAuthRedirect: true });
}

/** GET /admin/cycle/{cycleId} — 이용 이력 리스트만 온다 (기본 정보는 목록 응답에서 찾는다) */
export function getAdminCycleHistory(cycleId: string): Promise<AdminCycleHistory[]> {
  return apiGet<AdminCycleHistory[]>(`/admin/cycle/${encodeURIComponent(cycleId)}`, {
    skipAuthRedirect: true,
  });
}

export function getAdminCycleOwnStatics(cycleId: string): Promise<AdminCycleOwnStatics> {
  return apiGet<AdminCycleOwnStatics>(`/admin/cycle/${encodeURIComponent(cycleId)}/statics`, {
    skipAuthRedirect: true,
  });
}

/** 자전거에 달린 제보 — 제보 관리(03)와 같은 데이터를 자전거 기준으로 거른 것 */
export function getAdminCycleClaims(cycleId: string): Promise<AdminClaim[]> {
  return apiGet<AdminClaim[]>(`/admin/cycle/${encodeURIComponent(cycleId)}/claim`, {
    skipAuthRedirect: true,
  });
}
