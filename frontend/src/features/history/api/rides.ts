import { apiGet } from '@/shared/api/client';
import type { ElevationBar } from '@/shared/ui/ElevationChart';
import type { PathSegment } from '@/shared/ui/RouteSketch';

/**
 * 이동 기록 — 잘타슈 내비게이션 기록 (타슈 공식 대여이력 아님).
 * 백엔드 API 미정, msw 목업 기준 임시 스키마 (확정 시 이 파일만 수정)
 */
export interface RideSummary {
  id: number;
  from: string;
  to: string;
  /** ISO 8601 */
  date: string;
  durationMin: number;
  bikeCode: string;
}

export interface RideStats {
  totalRides: number;
  totalDistanceKm: number;
  totalDurationMin: number;
}

export interface RidesPage {
  stats: RideStats;
  rides: RideSummary[];
  page: number;
  totalPages: number;
}

export interface RideSegment {
  type: 'walk' | 'bike';
  durationMin: number;
  distanceM: number;
  /** 예: "유성구청역 대여소까지" */
  description: string;
  /** 자전거 구간 전용 */
  ascentM?: number;
  maxGradePct?: number;
}

/** 고도 그래프·경로 그림 타입은 `shared/ui/`로 올라갔다(#32). 기존 사용처를 위해 여기서 다시 내보낸다 */
export type { ElevationBar, PathSegment };

export interface RideDetail extends RideSummary {
  distanceKm: number;
  avgSpeedKmh: number;
  totalAscentM: number;
  maxGradePct: number;
  elevationBars: ElevationBar[];
  segments: RideSegment[];
  path: PathSegment[];
}

export function getRides(page: number): Promise<RidesPage> {
  return apiGet<RidesPage>('/rides', { params: { page } });
}

export function getRideDetail(rideId: string): Promise<RideDetail> {
  return apiGet<RideDetail>(`/rides/${rideId}`);
}
