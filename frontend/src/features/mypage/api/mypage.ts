import { apiGet } from '@/shared/api/client';

/** 24 프로필 이용 통계 — 백엔드 API 미정, msw 목업 기준 임시 스키마 (확정 시 이 파일만 수정) */
export interface MyStats {
  /** 이번 달 이동 횟수 */
  monthlyRides: number;
  /** 이번 달 이동 거리 (km) */
  distanceKm: number;
  /** 이번 달 이동 시간 (분) */
  durationMin: number;
}

export function getMyStats(): Promise<MyStats> {
  return apiGet<MyStats>('/users/me/stats');
}
