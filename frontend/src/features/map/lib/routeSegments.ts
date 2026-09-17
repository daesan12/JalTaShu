import type {
  RouteCandidate,
  RouteLeg,
  RouteManeuver,
  RoutePoint,
  TravelMode,
} from '@/shared/api/types';
import { haversineMeters, osrmToLatLng, type LatLng } from '@/shared/lib/coords';

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

/** 경로를 한 줄로 편 결과 — 구간·회전이 몇 번째 좌표에서 시작하는지 함께 들고 있다 */
export interface RouteOutline {
  /** 이동 구간 좌표를 이어 붙인 것(경계 중복 제거) */
  points: RoutePoint[];
  /** 이동 구간별 **마지막** 좌표 인덱스 */
  legEndIndexes: number[];
  /** step이 시작되는 좌표 인덱스와 그 step의 회전 정보 */
  stepStarts: { index: number; legIndex: number; mode: TravelMode; maneuver: RouteManeuver }[];
}

/**
 * 진행률·회전 안내가 **같은 좌표열과 같은 중복 제거 규칙**을 쓰도록 한 곳에서 편다.
 * 두 곳이 따로 펴면 거리 기준이 미묘하게 어긋나 "몇 m 앞" 이 틀어진다.
 */
export function outlineRoute(route: RouteCandidate): RouteOutline {
  const points: RoutePoint[] = [];
  const legEndIndexes: number[] = [];
  const stepStarts: RouteOutline['stepStarts'] = [];

  toLegs(route).forEach((leg, legIndex) => {
    for (const step of leg.steps) {
      let started = false;
      for (const point of step.points) {
        const last = points[points.length - 1];
        const duplicate =
          last !== undefined &&
          last.location[0] === point.location[0] &&
          last.location[1] === point.location[1];
        if (!duplicate) points.push(point);
        if (!started) {
          // 중복이라 건너뛴 경우에도 방금 그 좌표(= 앞 step의 끝)가 이 step의 시작점이다
          stepStarts.push({
            index: points.length - 1,
            legIndex,
            mode: leg.mode,
            maneuver: step.behave,
          });
          started = true;
        }
      }
    }
    legEndIndexes.push(points.length - 1);
  });

  return { points, legEndIndexes, stepStarts };
}

/** 좌표 사이의 누적 거리(m). 첫 항목은 0 */
export function cumulativeDistances(points: RoutePoint[]): number[] {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(
      cumulative[i - 1] +
        haversineMeters(osrmToLatLng(points[i - 1].location), osrmToLatLng(points[i].location)),
    );
  }
  return cumulative;
}
