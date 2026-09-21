import type { RouteCandidate, RouteType } from '@/shared/api/types';
import { routePoints, toLegs } from '@/features/map/lib/routeSegments';

/**
 * 10 경로 비교 — 서버가 정렬·필터 없이 준 후보를 프론트에서 요약·정렬한다(방법 B).
 * 순수 함수로 두어 유닛 테스트한다. 표시(칩·카드)는 컴포넌트가 이 값을 그대로 쓴다.
 *
 * **강점 뱃지 4종은 없앴다(2026-09-17).** 후보가 2개뿐이라 숫자를 비교해 순위를 매길 대상이 없고,
 * 서버가 후보마다 `type`을 붙여 주므로 그것을 그대로 라벨로 쓴다.
 */

/** 칩 — 각각 독립 토글(0~2개 선택). 필터가 아니라 정렬 기준이다(후보를 숨기지 않는다) */
export type RouteSort = 'bikes' | 'flat';

export interface RouteSummary {
  /** 서버 응답 배열에서의 원본 인덱스 — 정렬해도 폴리라인·선택 상태는 이 값으로 잇는다 */
  index: number;
  /** 후보 종류 — 라벨·경로선 색이 이 값으로 정해진다 */
  type: RouteType;
  /** 총 소요 시간(초) */
  totalSec: number;
  /** 도보 구간 합(초) */
  walkSec: number;
  /** 누적 상승(m) — 좌표를 따라가며 올라가는 구간만 더한 값 */
  ascentM: number;
  /**
   * 대여 대여소 도착 시 확보 가능 대수.
   * 서버가 필드를 빼거나 `null`로 주면 "없음"이다 — 아래 판정은 둘을 구분하지 않는다.
   */
  expectedBikeCnt?: number | null;
}

/** 경로의 누적 상승(m). 내려가는 구간은 세지 않는다 */
export function totalAscent(route: RouteCandidate): number {
  const points = routePoints(route);
  let ascent = 0;
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].altitude - points[i - 1].altitude;
    if (delta > 0) ascent += delta;
  }
  return Math.round(ascent);
}

export function summarizeRoute(route: RouteCandidate, index: number): RouteSummary {
  let walkSec = 0;
  for (const leg of toLegs(route)) {
    if (leg.mode === 'WALK') walkSec += leg.time;
  }
  return {
    index,
    type: route.type,
    totalSec: route.totalTime,
    walkSec,
    ascentM: totalAscent(route),
    expectedBikeCnt: route.expectedBikeCnt,
  };
}

export function summarizeRoutes(routes: RouteCandidate[]): RouteSummary[] {
  return routes.map(summarizeRoute);
}

const SORT_COMPARATORS: Record<RouteSort, (a: RouteSummary, b: RouteSummary) => number> = {
  // 값이 아직 안 오는 동안은 전부 동률이라 아래의 소요 시간 순으로 떨어진다
  bikes: (a, b) => (b.expectedBikeCnt ?? -1) - (a.expectedBikeCnt ?? -1),
  flat: (a, b) => a.ascentM - b.ascentM,
};

/** 확보 우선 칩을 못 쓰는 이유 — 쓸 수 있으면 `null` */
export type BikesSortBlock = 'no-data' | 'all-equal';

/**
 * 확보 우선 정렬이 **실제로 순서를 바꿀 수 있는지** 판정한다.
 *
 * "값이 하나라도 있으면 켠다"로는 부족하다. 지금 후보 2개(`BIKE`·`UPHILL`)는 **같은 대여소에서
 * 빌려** 자전거 구간만 다른 것이라 서버가 둘에 같은 예상 대수를 준다 — 켜 두면 눌러도 순서가
 * 절대 안 바뀌는 버튼이 된다.
 *
 * 그래서 기준을 "값이 서로 다른가"로 둔다. 나중에 서버가 대여소 조합을 달리한 후보를 더 주면
 * 값이 갈리면서 칩이 저절로 살아나고, 이 코드를 다시 고칠 일이 없다.
 */
export function bikesSortBlock(summaries: RouteSummary[]): BikesSortBlock | null {
  // 없음을 null로 통일해서 본다 — undefined와 null이 섞여 오면 값이 다른 것으로 새어 나간다
  const counts = summaries.map((s) => s.expectedBikeCnt ?? null);
  if (counts.every((c) => c === null)) return 'no-data';
  // 후보가 하나뿐이면 비교 대상이 없어 여기서 'all-equal'로 떨어진다 — 정렬할 게 없는 건 같다
  if (counts.some((c) => c !== counts[0])) return null;
  return 'all-equal';
}

/**
 * 선택된 칩들을 순서대로 적용해 정렬한 새 배열.
 * 배열 앞의 기준이 1차, 뒤의 기준은 동점 처리. 아무것도 없거나 모두 같으면 빠른 경로가 앞.
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

/** 초 → "21분". 1분 미만도 1분으로 보여준다 */
export function formatSecondsAsMinutes(sec: number): string {
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
