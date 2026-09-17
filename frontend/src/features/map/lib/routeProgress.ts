import type { Pos, RouteCandidate, RouteLeg, RoutePoint } from '@/shared/api/types';
import { haversineMeters, osrmToLatLng, posToLatLng } from '@/shared/lib/coords';
import { legPoints, toLegs } from '@/features/map/lib/routeSegments';

/**
 * 12 경로 안내 — 지금 어느 구간을 가고 있고 얼마나 남았는지 계산한다.
 *
 * 구간 경계는 서버가 `legs`로 나눠 주므로 **추정하지 않는다**(예전에는 거리 비율로 나눴다).
 * 회전 단위 안내(`steps[].behave`)와 음성은 다음 이슈에서 이 파일 위에 얹는다.
 *
 * 진행 위치는 현재 좌표에서 **가장 가까운 경로 좌표**로 판단한다. 경로를 벗어나도 가장 가까운
 * 지점으로 붙으므로 재탐색은 하지 않는다(기존 결정 유지).
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

/**
 * 이동 구간들의 좌표를 한 줄로 이으면서, 각 구간이 **어느 좌표에서 끝나는지**를 같이 기록한다.
 * 구간 경계 좌표는 앞뒤 구간이 공유하므로 이어 붙일 때 한 번만 넣는다.
 */
function flatten(legs: RouteLeg[]): { points: RoutePoint[]; legEndIndexes: number[] } {
  const points: RoutePoint[] = [];
  const legEndIndexes: number[] = [];
  for (const leg of legs) {
    for (const point of legPoints(leg)) {
      const last = points[points.length - 1];
      if (
        last !== undefined &&
        last.location[0] === point.location[0] &&
        last.location[1] === point.location[1]
      ) {
        continue;
      }
      points.push(point);
    }
    legEndIndexes.push(points.length - 1);
  }
  return { points, legEndIndexes };
}

/** 경로 좌표 사이의 누적 거리(m). 첫 항목은 0 */
function cumulativeDistances(points: RoutePoint[]): number[] {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(
      cumulative[i - 1] +
        haversineMeters(osrmToLatLng(points[i - 1].location), osrmToLatLng(points[i].location)),
    );
  }
  return cumulative;
}

/** 현재 위치에서 가장 가까운 경로 좌표의 인덱스 */
function nearestPointIndex(points: RoutePoint[], position: Pos): number {
  const me = posToLatLng(position);
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < points.length; i++) {
    const distance = haversineMeters(me, osrmToLatLng(points[i].location));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/** 현재 위치 기준 진행 상황. 위치를 모르면 출발 상태(첫 구간, 전체 남음)로 본다 */
export function getRouteProgress(route: RouteCandidate, position: Pos | null): RouteProgress {
  const legs = toLegs(route);
  if (legs.length === 0) return EMPTY;

  const { points, legEndIndexes } = flatten(legs);
  if (points.length < 2) return EMPTY;

  const cumulative = cumulativeDistances(points);
  const totalM = cumulative[cumulative.length - 1];
  if (totalM <= 0) return EMPTY;

  const traveledM = position === null ? 0 : cumulative[nearestPointIndex(points, position)];
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
export function hasArrived(route: RouteCandidate, position: Pos | null): boolean {
  if (position === null) return false;
  const { points } = flatten(toLegs(route));
  const destination = points[points.length - 1];
  if (destination === undefined) return false;
  return (
    haversineMeters(posToLatLng(position), osrmToLatLng(destination.location)) <=
    ARRIVAL_THRESHOLD_M
  );
}

/**
 * 구간 안내 문구 — "무엇을 하는 구간인지"만 말한다.
 * 회전 단위 문구(`steps[].behave.instruction`)는 서버가 한국어로 주지만, 화면에 붙이는 건 다음 이슈다.
 */
export function legInstruction(leg: RouteLeg | null, isLast: boolean): string {
  if (leg === null) return '경로를 확인하는 중입니다';
  if (leg.mode === 'WALK') return isLast ? '목적지까지 걸어가세요' : '대여소까지 걸어가세요';
  return '자전거로 이동하세요';
}
