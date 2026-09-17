import type { RouteType } from '@/shared/api/types';
import { readCssToken } from '@/shared/lib/cssToken';

/**
 * 후보 종류별 라벨과 색 — 서버 `routes[].type`을 그대로 쓴다(프론트가 숫자를 비교해 붙이던 강점 뱃지는 폐기).
 *
 * 색은 index.css `@theme`의 `--color-route-*` 토큰 하나를 라벨·경로선이 같이 쓴다.
 * Tailwind 4는 **소스에 찍힌 클래스 문자열만** CSS로 내보내므로, 아래 클래스들이 토큰의 사용처 역할을
 * 한다 — 지우면 `readCssToken()`이 빈 문자열을 받아 경로선 색이 사라진다.
 */
export const ROUTE_TYPE_STYLE: Record<
  RouteType,
  { label: string; cssVar: string; dotClass: string; pillClass: string }
> = {
  BIKE: {
    label: '일반',
    cssVar: '--color-route-bike',
    dotClass: 'bg-route-bike',
    pillClass: 'bg-route-bike/10 text-route-bike',
  },
  UPHILL: {
    label: '오르막 적음',
    cssVar: '--color-route-uphill',
    dotClass: 'bg-route-uphill',
    pillClass: 'bg-route-uphill/10 text-route-uphill',
  },
  WALK: {
    label: '도보',
    cssVar: '--color-route-walk',
    dotClass: 'bg-route-walk',
    pillClass: 'bg-route-walk/10 text-route-walk',
  },
};

/**
 * 선택 안 된 경로선 색. 선택한 경로만 종류 색을 띠어 대비가 크게 난다(2026-09-13 결정)
 */
const MUTED_ROUTE_CSS_VAR = '--color-gray-500';

/** 네이버 Polyline은 CSS 클래스가 아니라 색 문자열을 받으므로 토큰 값을 읽어 넘긴다 */
export function routeStrokeColor(type: RouteType): string {
  return readCssToken(ROUTE_TYPE_STYLE[type].cssVar);
}

export function mutedRouteStrokeColor(): string {
  return readCssToken(MUTED_ROUTE_CSS_VAR);
}
