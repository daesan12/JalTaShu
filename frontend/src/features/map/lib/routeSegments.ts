import type { Pos, RoutePath, RouteBehave } from '@/shared/api/types';

/**
 * 11 경로 상세 — 경로 하나를 "도보/자전거 구간"으로 나눈다.
 * 지도 폴리라인(2색)과 구간 안내 목록이 같은 결과를 쓴다. 순수 함수라 유닛 테스트한다.
 */

/** 이동이 있는 구간만 남긴 요약 — RENT/RETURN처럼 길이 0인 구간은 제외된다 */
export interface RouteLeg {
  behave: RouteBehave;
  /** 이 구간의 거리(m) */
  distanceM: number;
  /** 이 구간의 소요 시간(초) */
  timeSec: number;
}

export interface RouteLegPath extends RouteLeg {
  /** 이 구간에 해당하는 경로 좌표(2점 이상) */
  points: Pos[];
}

/** 실제로 이동하는 구간인지 — 대여·반납(RENT/RETURN)은 길이 0으로 끼어 온다 */
function isMoving(distanceM: number): boolean {
  return distanceM > 0;
}

/** 구간 안내 목록 — 이동이 있는 구간만, 응답 순서 그대로 */
export function toLegs(route: RoutePath): RouteLeg[] {
  const legs: RouteLeg[] = [];
  for (let i = 0; i < route.behave.length; i++) {
    const distanceM = route.distance[i] ?? 0;
    if (!isMoving(distanceM)) continue;
    legs.push({ behave: route.behave[i], distanceM, timeSec: route.time[i] ?? 0 });
  }
  return legs;
}

/**
 * 경로 좌표를 구간별로 쪼갠다 — 지도에 도보/자전거 2색으로 그리기 위해서.
 *
 * ⚠ 가정(2026-09-14): 백엔드 `location[]`은 경로 전체 좌표가 한 줄로 온다. 어느 좌표가 어느 구간인지
 * 알려주는 필드가 없어, `distance[]`의 누적 비율로 좌표 인덱스를 나눈다(좌표가 경로를 따라 고르게
 * 찍혀 있다고 본다). 실제 응답이 구간별로 쪼개져 오면 이 함수만 고친다.
 * 경계 좌표는 양쪽 구간이 함께 가져 선이 끊겨 보이지 않게 한다.
 */
export function splitByLeg(route: RoutePath): RouteLegPath[] {
  const points = route.location;
  const legs = toLegs(route);
  if (points.length < 2 || legs.length === 0) return [];

  const totalM = legs.reduce((sum, leg) => sum + leg.distanceM, 0);
  if (totalM <= 0) return [];

  const lastIndex = points.length - 1;
  const result: RouteLegPath[] = [];
  let coveredM = 0;
  let startIndex = 0;

  legs.forEach((leg, i) => {
    coveredM += leg.distanceM;
    const endIndex =
      i === legs.length - 1
        ? lastIndex
        : Math.min(
            lastIndex,
            Math.max(startIndex + 1, Math.round((coveredM / totalM) * lastIndex)),
          );
    result.push({ ...leg, points: points.slice(startIndex, endIndex + 1) });
    startIndex = endIndex;
  });

  // 좌표가 구간 수보다 적으면 뒤쪽 구간이 1점만 받을 수 있다 — 선을 못 그리므로 버린다
  return result.filter((leg) => leg.points.length >= 2);
}
