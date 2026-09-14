const stroke = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

interface RouteDetailControlsProps {
  /** 비교 화면(10)으로 돌아간다 */
  onBack: () => void;
  /** 목적지 이름 — 어디로 가는 경로인지 상단에 보여준다 */
  destinationTitle: string;
}

/**
 * 11 경로 상세의 지도 위 컨트롤 — ←(비교로 복귀)와 목적지 이름.
 * 10의 "다시 조회"는 여기 없다. 경로를 다시 고르려면 ←로 비교 화면에서 고른다.
 */
export function RouteDetailControls({ onBack, destinationTitle }: RouteDetailControlsProps) {
  return (
    <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-3 p-4">
      <button
        type="button"
        aria-label="경로 비교로 돌아가기"
        onClick={onBack}
        className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-gray-700 shadow-md transition-[scale,background-color] duration-75 active:scale-95 active:bg-gray-100"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
          <path d="M19 12H5m6-6-6 6 6 6" {...stroke} />
        </svg>
      </button>

      {destinationTitle ? (
        <div className="pointer-events-auto flex min-h-11 min-w-0 flex-1 items-center rounded-full bg-surface px-4 shadow-md">
          <span className="truncate text-sm font-semibold text-gray-900">{destinationTitle}</span>
        </div>
      ) : null}
    </div>
  );
}
