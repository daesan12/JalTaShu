import type { RouteLeg, TravelStatus } from '@/shared/api/types';

/**
 * 12 재탐색 — 경로를 벗어났을 때 다시 계산할지 판단한다.
 *
 * 예전에는 "재탐색은 하지 않는다"로 두었는데, 백엔드에 `GET /map/re-route`가 생겨 뒤집었다.
 * 서버는 **지금 어느 구간을 가는 중인지**(`travelStatus`)와 쓰기로 한 대여소를 알아야 같은 조건을
 * 유지한 채 다시 계산할 수 있다 — 자전거를 이미 빌렸는데 다른 대여소로 보내면 안 되기 때문이다.
 */

/** 이 거리 이상 벗어나면 "길을 잘못 들었다"로 본다. GPS 오차(도심 20~30m)보다 넉넉히 잡는다 */
export const OFF_ROUTE_THRESHOLD_M = 50;

/** 다시 조회 사이의 최소 간격(ms) — 위치가 튈 때마다 서버를 두드리지 않게 */
export const REROUTE_MIN_INTERVAL_MS = 15_000;

/** 지금 가고 있는 구간을 서버가 쓰는 값으로 — 도보는 대여소 전(WALK1)·후(WALK2)를 구분한다 */
export function toTravelStatus(leg: RouteLeg | null, legIndex: number): TravelStatus {
  if (leg === null) return 'WALK1';
  if (leg.mode === 'BICYCLE') return 'BIKE';
  return legIndex === 0 ? 'WALK1' : 'WALK2';
}

export interface RerouteDecision {
  /** 경로에서 벗어난 거리(m) */
  offRouteM: number;
  /** 마지막으로 다시 조회한 시각(ms). 한 번도 안 했으면 null */
  lastAt: number | null;
  now: number;
  /** 이미 조회 중이면 또 보내지 않는다 */
  pending: boolean;
}

export function shouldReRoute({ offRouteM, lastAt, now, pending }: RerouteDecision): boolean {
  if (pending) return false;
  if (offRouteM < OFF_ROUTE_THRESHOLD_M) return false;
  if (lastAt !== null && now - lastAt < REROUTE_MIN_INTERVAL_MS) return false;
  return true;
}
