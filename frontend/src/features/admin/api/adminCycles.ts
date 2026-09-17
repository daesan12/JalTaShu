import { apiGet } from '@/shared/api/client';
import type { AdminClaim } from '@/features/admin/api/adminClaims';

/**
 * 05·07 자전거 관리 — 목록·이용 이력·통계는 API 명세 구현 O(응답 형태 임시),
 * 자전거별 제보는 구현 X라 목업 기준. 401은 관리자 가드가 처리(skipAuthRedirect).
 */

/** 서버 enum — 한글 라벨은 화면에서 (AdminBadge 규칙) */
export type CycleStatus = 'ACTIVE' | 'SUSPENDED';

export const CYCLE_STATUS_LABEL: Record<CycleStatus, '정상' | '정지'> = {
  ACTIVE: '정상',
  SUSPENDED: '정지',
};

export interface AdminCycleSummary {
  cycleId: string;
  /** 배치 대여소 — 대여 중(이동 중)이면 null */
  stationId: string | null;
  stationName: string | null;
  statement: CycleStatus;
  /** 미해결 제보 수 */
  openClaimCnt: number;
  lastUsedAt: string;
}

/** GET /admin/cycle/statics — 목록 상단 통계 카드 */
export interface AdminCycleStatics {
  totalCnt: number;
  activeCnt: number;
  suspendedCnt: number;
  /** 미해결 제보가 달린 자전거 수 */
  claimedCnt: number;
}

/** 이용 이력 한 건 */
export interface AdminCycleRide {
  rideId: number;
  startAt: string;
  endAt: string;
  fromStation: string;
  toStation: string;
  durationMin: number;
  distanceKm: number;
}

/** GET /admin/cycle/{cycleId} — 기본 정보 + 이용 이력 */
export interface AdminCycleDetail extends AdminCycleSummary {
  rides: AdminCycleRide[];
}

/** GET /admin/cycle/{cycleId}/statics — 자전거 누적 통계 */
export interface AdminCycleOwnStatics {
  totalRides: number;
  totalDistanceKm: number;
  totalDurationMin: number;
}

/** 명세 필터(cycle·stationName·statement·hasClaim)는 목업이라 전체를 받아 클라에서 거른다 */
export function getAdminCycles(): Promise<AdminCycleSummary[]> {
  return apiGet<AdminCycleSummary[]>('/admin/cycle/list', { skipAuthRedirect: true });
}

export function getAdminCycleStatics(): Promise<AdminCycleStatics> {
  return apiGet<AdminCycleStatics>('/admin/cycle/statics', { skipAuthRedirect: true });
}

export function getAdminCycle(cycleId: string): Promise<AdminCycleDetail> {
  return apiGet<AdminCycleDetail>(`/admin/cycle/${encodeURIComponent(cycleId)}`, {
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
