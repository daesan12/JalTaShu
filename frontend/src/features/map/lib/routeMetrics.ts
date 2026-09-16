import type { RoutePath } from '@/shared/api/types';

/**
 * 10 경로 비교 — 서버가 정렬·필터 없이 준 후보를 프론트에서 요약·정렬·뱃지 부여한다(방법 B).
 * 순수 함수로 두어 유닛 테스트한다. 표시(칩·카드)는 컴포넌트가 이 값을 그대로 쓴다.
 */

/** 칩 — 각각 독립 토글(0~2개 선택). 필터가 아니라 정렬 기준이다(후보를 숨기지 않는다) */
export type RouteSort = 'bikes' | 'flat';

/**
 * 후보 강점 뱃지. 응답에는 없고 후보끼리 숫자를 비교해 프론트가 붙인다.
 * fast=가장 빠름 / bikes=자전거 많음 / flat=오르막 적음 / walk=도보 짧음
 */
export type RouteBadgeKind = 'fast' | 'bikes' | 'flat' | 'walk';

export interface RouteSummary {
  /** 서버 응답 배열에서의 원본 인덱스 — 정렬해도 폴리라인·선택 상태는 이 값으로 잇는다 */
  index: number;
  /** 총 소요 시간(초) */
  totalSec: number;
  /** 도보 구간 합(초) */
  walkSec: number;
  /** 누적 상승(m) — 고도 배열에서 올라가는 구간만 더한 값 */
  ascentM: number;
  /** 대여 대여소 도착 시 확보 가능 대수 */
  expectedBikeCnt: number;
}

/** 고도 배열의 누적 상승(m). 내려가는 구간은 세지 않는다 */
export function totalAscent(altitude: RoutePath['altitude']): number {
  let ascent = 0;
  for (let i = 1; i < altitude.length; i++) {
    const delta = altitude[i].altitude - altitude[i - 1].altitude;
    if (delta > 0) ascent += delta;
  }
  return Math.round(ascent);
}

export function summarizeRoute(route: RoutePath, index: number): RouteSummary {
  let totalSec = 0;
  let walkSec = 0;
  for (let i = 0; i < route.time.length; i++) {
    totalSec += route.time[i];
    if (route.behave[i] === 'WALK') walkSec += route.time[i];
  }
  return {
    index,
    totalSec,
    walkSec,
    ascentM: totalAscent(route.altitude),
    expectedBikeCnt: route.expectedBikeCnt,
  };
}

export function summarizeRoutes(routes: RoutePath[]): RouteSummary[] {
  return routes.map(summarizeRoute);
}

const SORT_COMPARATORS: Record<RouteSort, (a: RouteSummary, b: RouteSummary) => number> = {
  bikes: (a, b) => b.expectedBikeCnt - a.expectedBikeCnt,
  flat: (a, b) => a.ascentM - b.ascentM,
};

/**
 * 선택된 칩들을 순서대로 적용해 정렬한 새 배열.
 * 배열 앞의 기준이 1차, 뒤의 기준은 동점 처리. 아무것도 없거나 모두 같으면 빠른 경로가 앞.
 * (칩을 둘 다 켜면 [bikes, flat] — 확보 우선으로 줄 세우고 동률은 오르막 적은 쪽)
 */
export function sortSummaries(summaries: RouteSummary[], sorts: RouteSort[]): RouteSummary[] {
  return [...summaries].sort((a, b) => {
    for (const key of sorts) {
      const diff = SORT_COMPARATORS[key](a, b);
      if (diff !== 0) return diff;
    }
    return a.totalSec - b.totalSec;
  });
}

/** 뱃지를 붙이는 순서. 한 후보가 여러 기준에서 1등이면 앞 순서의 뱃지만 받고, 그 기준은 다음 후보에게 */
const BADGE_ORDER: {
  kind: RouteBadgeKind;
  better: (a: RouteSummary, b: RouteSummary) => boolean;
}[] = [
  { kind: 'fast', better: (a, b) => a.totalSec < b.totalSec },
  { kind: 'bikes', better: (a, b) => a.expectedBikeCnt > b.expectedBikeCnt },
  { kind: 'flat', better: (a, b) => a.ascentM < b.ascentM },
  { kind: 'walk', better: (a, b) => a.walkSec < b.walkSec },
];

/**
 * 후보마다 강점 뱃지를 최대 하나 붙인다(원본 인덱스 순 배열, 없으면 null).
 * 뱃지 하나는 후보 하나에게만 간다. 후보가 4개 미만이면 뒷 순서 뱃지는 아무도 못 받고,
 * 4개를 넘으면 뱃지 없는 후보가 생긴다. 동점이면 앞 인덱스가 받는다
 */
export function assignBadges(summaries: RouteSummary[]): (RouteBadgeKind | null)[] {
  const badges: (RouteBadgeKind | null)[] = summaries.map(() => null);
  for (const { kind, better } of BADGE_ORDER) {
    let best: RouteSummary | null = null;
    for (const s of summaries) {
      if (badges[s.index] !== null) continue;
      if (best === null || better(s, best)) best = s;
    }
    if (best !== null) badges[best.index] = kind;
  }
  return badges;
}

/** 초 → "21분". 1분 미만도 1분으로 보여준다 */
export function formatMinutes(sec: number): string {
  return `${Math.max(1, Math.round(sec / 60))}분`;
}

const ARRIVAL_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** 조회 시각 + 소요 시간 → "오전 10:47". 출발은 "지금"이라 조회한 시각을 출발 시각으로 본다 */
export function formatArrival(fetchedAt: number, totalSec: number): string {
  return ARRIVAL_FORMAT.format(new Date(fetchedAt + totalSec * 1000));
}
