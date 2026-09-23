import type { Pos, RouteCandidate, RouteLeg, RoutePoint } from '@/shared/api/types';
import { haversineMeters, osrmToLatLng, posToLatLng } from '@/shared/lib/coords';
import { cumulativeDistances, outlineRoute, toLegs } from '@/features/map/lib/routeSegments';

/**
 * 12 경로 안내 — 지금 어느 구간을 가고 있고 얼마나 남았는지 계산한다.
 *
 * 구간 경계는 서버가 `legs`로 나눠 주므로 **추정하지 않는다**(예전에는 거리 비율로 나눴다).
 * 회전 단위 안내는 `routeCues.ts`가 이 진행률 위에 얹는다.
 *
 * 진행 위치는 현재 좌표에서 **가장 가까운 경로 좌표**로 판단한다. 경로를 벗어나도 가장 가까운
 * 지점으로 붙고, 얼마나 벗어났는지는 `offRouteM`으로 따로 알려준다(재탐색 판단용).
 */

export interface RouteProgress {
  /** 이동 구간 목록에서의 현재 구간 번호(0부터). 구간이 없으면 -1 */
  legIndex: number;
  /** 현재 구간 */
  leg: RouteLeg | null;
  /** 목적지까지 남은 거리(m) */
  remainingM: number;
  /** 현재 구간이 끝날 때까지 남은 거리(m) */
  legRemainingM: number;
  /** 경로 전체에서 지나온 비율 0~1 */
  ratio: number;
  /** 경로 시작부터 지금까지 온 거리(m) — 회전 안내가 "다음 회전까지" 를 재는 기준 */
  traveledM: number;
  /** 경로에서 얼마나 벗어나 있는지(m). 경로 위면 0에 가깝다 — 재탐색 판단에 쓴다 */
  offRouteM: number;
}

const EMPTY: RouteProgress = {
  legIndex: -1,
  leg: null,
  remainingM: 0,
  legRemainingM: 0,
  ratio: 0,
  traveledM: 0,
  offRouteM: 0,
};

/** 현재 위치에서 가장 가까운 경로 좌표 — 인덱스와 그 거리(경로에서 벗어난 정도) */
function nearestPoint(points: RoutePoint[], position: Pos): { index: number; distanceM: number } {
  const me = posToLatLng(position);
  let index = 0;
  let distanceM = Infinity;
  for (let i = 0; i < points.length; i++) {
    const distance = haversineMeters(me, osrmToLatLng(points[i].location));
    if (distance < distanceM) {
      distanceM = distance;
      index = i;
    }
  }
  return { index, distanceM };
}

/** 현재 위치 기준 진행 상황. 위치를 모르면 출발 상태(첫 구간, 전체 남음)로 본다 */
export function getRouteProgress(route: RouteCandidate, position: Pos | null): RouteProgress {
  const legs = toLegs(route);
  if (legs.length === 0) return EMPTY;

  const { points, legEndIndexes } = outlineRoute(route);
  if (points.length < 2) return EMPTY;

  const cumulative = cumulativeDistances(points);
  const totalM = cumulative[cumulative.length - 1];
  if (totalM <= 0) return EMPTY;

  const nearest = position === null ? null : nearestPoint(points, position);
  const traveledM = nearest === null ? 0 : cumulative[nearest.index];
  const legEndM = legEndIndexes.map((index) => cumulative[index]);
  // 아직 끝나지 않은 첫 구간이 지금 가고 있는 구간이다. 다 지났으면 마지막 구간에 머문다
  const firstUnfinished = legEndM.findIndex((end) => traveledM < end);
  const legIndex = firstUnfinished === -1 ? legs.length - 1 : firstUnfinished;

  return {
    legIndex,
    leg: legs[legIndex],
    remainingM: Math.max(0, Math.round(totalM - traveledM)),
    legRemainingM: Math.max(0, Math.round(legEndM[legIndex] - traveledM)),
    ratio: Math.min(1, traveledM / totalM),
    traveledM,
    offRouteM: nearest === null ? 0 : Math.round(nearest.distanceM),
  };
}

/**
 * 구간 안내 문구 — "무엇을 하는 구간인지"만 말한다.
 * 회전 단위 문구는 `routeCues.ts`가 서버 `instruction`을 그대로 쓴다. 둘은 같이 보여준다 —
 * 회전만 보면 지금 걷는 중인지 타는 중인지 알 수 없다.
 */
export function legInstruction(leg: RouteLeg | null, isLast: boolean): string {
  if (leg === null) return '경로를 확인하는 중입니다';
  if (leg.mode === 'WALK') return isLast ? '목적지까지 걸어가세요' : '대여소까지 걸어가세요';
  return '자전거로 이동하세요';
}
