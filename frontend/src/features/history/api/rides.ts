import { apiGet } from '@/shared/api/client';
import type { GradeClass } from '@/features/history/lib/grade';

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

export interface ElevationBar {
  grade: GradeClass;
  /** 상대 높이 0~1 */
  value: number;
}

/** 추상 경로 그림용 좌표 (0~100 공간) — 지도 연동 시 실제 폴리라인으로 교체 */
export interface PathSegment {
  kind: 'walk' | GradeClass;
  points: [number, number][];
}

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
