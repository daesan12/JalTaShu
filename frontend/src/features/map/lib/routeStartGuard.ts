import type { Pos } from '@/shared/api/types';
import { haversineMeters, posToLatLng } from '@/shared/lib/coords';

/** GPS 오차와 건물 출입구 차이를 감안해 이 거리 안에서는 선택한 출발지에 도착한 것으로 본다. */
export const ROUTE_START_PROXIMITY_M = 100;

export function distanceToRouteStart(current: Pos, selectedStart: Pos): number {
  return haversineMeters(posToLatLng(current), posToLatLng(selectedStart));
}

export function needsRouteStartChoice(current: Pos, selectedStart: Pos): boolean {
  return distanceToRouteStart(current, selectedStart) > ROUTE_START_PROXIMITY_M;
}
