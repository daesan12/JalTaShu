import { apiGet } from '@/shared/api/client';
import type { BikeStation } from '@/shared/api/types';

export const BIKE_STATIONS_QUERY_KEY = ['map', 'bike-station'] as const;

/** 07 메인 지도 대여소 목록 — 백엔드 GET /map/bike-station */
export function getBikeStations(): Promise<BikeStation[]> {
  return apiGet<BikeStation[]>('/map/bike-station');
}
