import type { Pos, RoutePath } from '@/shared/api/types';
import { haversineMeters, posToLatLng } from '@/shared/lib/coords';
import { toLegs, type RouteLeg } from '@/features/map/lib/routeSegments';

/**
 * 12 경로 안내 — 지금 어느 구간을 가고 있고 얼마나 남았는지 계산한다.
 *
 * 백엔드 경로 응답에는 **회전 지점 정보가 없다**(좌표 배열과 구간별 거리·시간뿐).
 * 그래서 "몇 m 앞 우회전"은 만들 수 없고, 구간(도보 → 자전거 → 도보) 단위로만 안내한다.
 * OSRM maneuver가 응답에 추가되면 이 파일 위에 상세 안내를 얹는다.
 *
 * 진행 위치는 현재 좌표에서 **가장 가까운 경로 좌표**로 판단한다. 경로를 벗어나도 가장 가까운
 * 지점으로 붙으므로 재탐색은 하지 않는다(이번 범위 밖).
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
}

const EMPTY: RouteProgress = {
  legIndex: -1,
  leg: null,
  remainingM: 0,
  legRemainingM: 0,
  ratio: 0,
};

/** 경로 좌표 사이의 누적 거리(m). 첫 항목은 0 */
function cumulativeDistances(points: Pos[]): number[] {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(
      cumulative[i - 1] + haversineMeters(posToLatLng(points[i - 1]), posToLatLng(points[i])),
    );
  }
  return cumulative;
}

/** 현재 위치에서 가장 가까운 경로 좌표의 인덱스 */
function nearestPointIndex(points: Pos[], position: Pos): number {
  const me = posToLatLng(position);
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < points.length; i++) {
    const distance = haversineMeters(me, posToLatLng(points[i]));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/**
 * 구간이 끝나는 지점의 누적 거리(m).
 * `location[]`에는 구간 경계가 없어 `distance[]` 누적 비율로 나눈다(폴리라인 2색과 같은 가정).
 */
function legEndDistances(legs: RouteLeg[], totalRouteM: number): number[] {
  const totalLegM = legs.reduce((sum, leg) => sum + leg.distanceM, 0);
  if (totalLegM <= 0) return legs.map(() => totalRouteM);
  let covered = 0;
  return legs.map((leg) => {
    covered += leg.distanceM;
    return (covered / totalLegM) * totalRouteM;
  });
}

/** 현재 위치 기준 진행 상황. 위치를 모르면 출발 상태(첫 구간, 전체 남음)로 본다 */
export function getRouteProgress(route: RoutePath, position: Pos | null): RouteProgress {
  const points = route.location;
  const legs = toLegs(route);
  if (points.length < 2 || legs.length === 0) return EMPTY;

  const cumulative = cumulativeDistances(points);
  const totalM = cumulative[cumulative.length - 1];
  if (totalM <= 0) return EMPTY;

  const traveledM = position === null ? 0 : cumulative[nearestPointIndex(points, position)];
  const ends = legEndDistances(legs, totalM);
  // 아직 끝나지 않은 첫 구간이 지금 가고 있는 구간이다. 다 지났으면 마지막 구간에 머문다
  const firstUnfinished = ends.findIndex((end) => traveledM < end);
  const legIndex = firstUnfinished === -1 ? legs.length - 1 : firstUnfinished;

  return {
    legIndex,
    leg: legs[legIndex],
    remainingM: Math.max(0, Math.round(totalM - traveledM)),
    legRemainingM: Math.max(0, Math.round(ends[legIndex] - traveledM)),
    ratio: Math.min(1, traveledM / totalM),
  };
}

/** 도착 판정 거리(m) — GPS 오차를 감안해 정확히 0m이 아니라 이 안쪽이면 도착으로 본다 */
const ARRIVAL_THRESHOLD_M = 30;

/**
 * 목적지에 실제로 도착했는지 — 12 안내 자동 종료 판단에 쓴다.
 * `RouteProgress.remainingM`은 쓰지 않는다 — 그건 "경로 위 가장 가까운 점"까지의 거리라, 사용자가
 * 경로에서 멀리 떨어져 있어도(다른 지역 등) 그 점이 우연히 도착지 쪽 끝이면 0에 가깝게 나온다.
 * 도착 판정은 **목적지 좌표까지의 직선 거리**로만 본다.
 */
export function hasArrived(route: RoutePath, position: Pos | null): boolean {
  if (position === null) return false;
  const destination = route.location[route.location.length - 1];
  if (destination === undefined) return false;
  return haversineMeters(posToLatLng(position), posToLatLng(destination)) <= ARRIVAL_THRESHOLD_M;
}

/** 구간 안내 문구 — 회전 정보가 없어 "무엇을 하는 구간인지"만 말한다 */
export function legInstruction(leg: RouteLeg | null, isLast: boolean): string {
  if (leg === null) return '경로를 확인하는 중입니다';
  if (leg.behave === 'WALK') return isLast ? '목적지까지 걸어가세요' : '대여소까지 걸어가세요';
  return '자전거로 이동하세요';
}
