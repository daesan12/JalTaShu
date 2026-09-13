import { ROUTE_BADGE, ROUTE_BADGE_ORDER } from '@/features/map/lib/routeBadges';
import type { RouteBadgeKind } from '@/features/map/lib/routeMetrics';

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

const ROUND_BUTTON_CLASS =
  'flex h-11 w-11 items-center justify-center rounded-full bg-surface text-gray-700 shadow-md transition-[scale,background-color] duration-75 active:scale-95 active:bg-gray-100 disabled:pointer-events-none disabled:opacity-60';

interface RouteCompareControlsProps {
  /** 원본 인덱스 순 뱃지 — 실제로 붙은 종류만 범례에 올린다 */
  badges: (RouteBadgeKind | null)[];
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

/**
 * 10 경로 비교 중 지도 위 컨트롤 — 뒤로가기(←)·경로선 범례·다시 조회.
 * 검색바·공지 배너·갱신 배지 자리를 대신한다(Figma 10).
 */
export function RouteCompareControls({
  badges,
  onBack,
  onRefresh,
  refreshing,
}: RouteCompareControlsProps) {
  const present = new Set(badges);
  const legend = ROUTE_BADGE_ORDER.filter((kind) => present.has(kind));

  return (
    <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4">
      <button
        type="button"
        aria-label="경로 비교 닫기"
        onClick={onBack}
        className={`pointer-events-auto ${ROUND_BUTTON_CLASS}`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
          <path d="M19 12H5m6-6-6 6 6 6" {...stroke} />
        </svg>
      </button>

      <div className="pointer-events-auto flex flex-col items-end gap-3">
        {legend.length === 0 ? null : (
          <ul className="flex flex-col gap-1.5 rounded-xl bg-surface/95 px-3 py-2.5 shadow-md">
            {legend.map((kind) => (
              <li key={kind} className="flex items-center gap-2 text-xs font-medium text-gray-700">
                <span
                  aria-hidden
                  className={`h-1 w-4 rounded-full ${ROUTE_BADGE[kind].dotClass}`}
                />
                {ROUTE_BADGE[kind].label}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          aria-label="경로 다시 조회"
          onClick={onRefresh}
          disabled={refreshing}
          className={ROUND_BUTTON_CLASS}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`}
          >
            <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" {...stroke} />
          </svg>
        </button>
      </div>
    </div>
  );
}
