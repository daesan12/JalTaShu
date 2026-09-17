import type { RouteCandidate, RouteLeg, RoutePoint } from '@/shared/api/types';
import { osrmToLatLng, type LatLng } from '@/shared/lib/coords';

/**
 * 경로 하나를 "도보/자전거 구간"으로 나눈다 — 지도 폴리라인(2색)과 11의 구간 안내 목록이 같은 결과를 쓴다.
 *
 * 예전에는 응답에 구간 경계가 없어 거리 누적 비율로 좌표를 잘라 **추정**했는데, 실응답은
 * `legs[].mode`로 이미 나뉘어 오고 좌표도 leg 안에 들어 있다. 그래서 여기서는 **자르지 않고 꺼내기만** 한다.
 */

/** 같은 좌표인지 — step 경계에서 같은 점이 두 번 나온다 */
function samePoint(a: RoutePoint, b: RoutePoint): boolean {
  return a.location[0] === b.location[0] && a.location[1] === b.location[1];
}

/** 이어 붙이면서 바로 앞과 같은 좌표는 버린다 */
function appendPoints(into: RoutePoint[], points: RoutePoint[]): void {
  for (const point of points) {
    const last = into[into.length - 1];
    if (last !== undefined && samePoint(last, point)) continue;
    into.push(point);
  }
}

/** 구간 하나의 좌표 — step들을 이어 붙인다 */
export function legPoints(leg: RouteLeg): RoutePoint[] {
  const points: RoutePoint[] = [];
  for (const step of leg.steps) appendPoints(points, step.points);
  return points;
}

/** 경로 전체 좌표 — 고도 그래프·진행률처럼 경로를 한 줄로 봐야 하는 곳에서 쓴다 */
export function routePoints(route: RouteCandidate): RoutePoint[] {
  const points: RoutePoint[] = [];
  for (const leg of route.legs) appendPoints(points, legPoints(leg));
  return points;
}

/** 경로 전체를 지도 좌표로 — 폴리라인·화면 맞춤(fitBounds)에 쓴다 */
export function routeLatLngs(route: RouteCandidate): LatLng[] {
  return routePoints(route).map((point) => osrmToLatLng(point.location));
}

/** 이동이 있는 구간만 — 길이 0인 구간은 목록에도 지도에도 내지 않는다 */
export function toLegs(route: RouteCandidate): RouteLeg[] {
  return route.legs.filter((leg) => leg.distance > 0);
}

export interface RouteLegPath {
  leg: RouteLeg;
  /** 이 구간의 경로선 좌표(2점 이상) */
  points: LatLng[];
}

/** 구간별 좌표 — 지도에 도보/자전거 2색으로 그리기 위해서 */
export function splitByLeg(route: RouteCandidate): RouteLegPath[] {
  return toLegs(route)
    .map((leg) => ({ leg, points: legPoints(leg).map((p) => osrmToLatLng(p.location)) }))
    .filter((entry) => entry.points.length >= 2);
}
