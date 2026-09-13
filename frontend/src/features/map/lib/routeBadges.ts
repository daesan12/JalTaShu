import type { RouteBadgeKind } from '@/features/map/lib/routeMetrics';

/**
 * 뱃지 종류별 라벨과 색. 색은 index.css `@theme`의 `--color-route-*` 토큰 하나를 뱃지·범례·경로선이 같이 쓴다.
 * Tailwind가 소스에서 클래스 문자열을 찍어 찾으므로 조합하지 않고 통째로 적는다.
 */
export const ROUTE_BADGE: Record<
  RouteBadgeKind,
  { label: string; cssVar: string; dotClass: string; pillClass: string }
> = {
  fast: {
    label: '가장 빠름',
    cssVar: '--color-route-fast',
    dotClass: 'bg-route-fast',
    pillClass: 'bg-route-fast/10 text-route-fast',
  },
  bikes: {
    label: '자전거 많음',
    cssVar: '--color-route-bikes',
    dotClass: 'bg-route-bikes',
    pillClass: 'bg-route-bikes/10 text-route-bikes',
  },
  flat: {
    label: '오르막 적음',
    cssVar: '--color-route-flat',
    dotClass: 'bg-route-flat',
    pillClass: 'bg-route-flat/10 text-route-flat',
  },
  walk: {
    label: '도보 짧음',
    cssVar: '--color-route-walk',
    dotClass: 'bg-route-walk',
    pillClass: 'bg-route-walk/10 text-route-walk',
  },
};

/** 범례·뱃지 표시 순서 */
export const ROUTE_BADGE_ORDER: RouteBadgeKind[] = ['fast', 'bikes', 'flat', 'walk'];

/** 뱃지 없는 후보(5개 이상 올 때)의 경로선 색 */
const NO_BADGE_CSS_VAR = '--color-gray-400';

/**
 * 네이버 Polyline은 CSS 클래스가 아니라 색 문자열을 받으므로 토큰 값을 읽어 넘긴다.
 * 토큰은 위 클래스들이 소스에 있어 항상 CSS로 나온다(Tailwind 4는 쓰이는 변수만 출력).
 */
export function routeStrokeColor(kind: RouteBadgeKind | null): string {
  const cssVar = kind === null ? NO_BADGE_CSS_VAR : ROUTE_BADGE[kind].cssVar;
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
}
