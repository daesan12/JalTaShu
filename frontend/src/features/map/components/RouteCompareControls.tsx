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
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

/**
 * 10 경로 비교 중 지도 위 컨트롤 — 뒤로가기(←)·다시 조회.
 * 검색바·공지 배너·갱신 배지 자리를 대신한다(Figma 10).
 * Figma의 4색 범례는 뺐다 — 선택한 경로만 색이 있고 나머지는 회색이라 범례가 뜻을 잃는다(2026-09-13)
 */
export function RouteCompareControls({ onBack, onRefresh, refreshing }: RouteCompareControlsProps) {
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

      <button
        type="button"
        aria-label="경로 다시 조회"
        onClick={onRefresh}
        disabled={refreshing}
        className={`pointer-events-auto ${ROUND_BUTTON_CLASS}`}
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
  );
}
