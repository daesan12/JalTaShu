const stroke = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

const ROUND_BUTTON_CLASS =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-gray-700 shadow-md transition-[scale,background-color] duration-75 active:scale-95 active:bg-gray-100 disabled:pointer-events-none disabled:opacity-60';

interface RouteCompareControlsProps {
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  /** 출발지 표시("현재 위치" 또는 고른 장소 이름) */
  startLabel: string;
  /** 목적지 표시 */
  destinationLabel: string;
  /** 출발 칸을 누르면 — 08과 같은 화면으로 출발지를 다시 고른다 */
  onEditStart: () => void;
  /** 도착 칸을 누르면 — 08과 같은 화면으로 목적지를 다시 고른다 */
  onEditDestination: () => void;
  /** 바꾸기(↕) — 출발지·목적지를 서로 맞바꾼다 */
  onSwap: () => void;
}

/**
 * 10 경로 비교 중 지도 위 컨트롤 — 뒤로가기(←)·출발/도착 편집 카드·다시 조회.
 * 출발/도착 칸은 08 검색 화면과 같은 자리(검색·최근검색·지도에서 선택)를 그대로 연다.
 * 여기서 고치면 그 자리에서 바로 새 경로를 다시 조회한다(비교 화면을 벗어나지 않음).
 * Figma의 4색 범례는 뺐다 — 선택한 경로만 색이 있고 나머지는 회색이라 범례가 뜻을 잃는다(2026-09-13)
 */
export function RouteCompareControls({
  onBack,
  onRefresh,
  refreshing,
  startLabel,
  destinationLabel,
  onEditStart,
  onEditDestination,
  onSwap,
}: RouteCompareControlsProps) {
  return (
    <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-2 p-4">
      <div className="pointer-events-auto flex flex-col gap-2">
        <button
          type="button"
          aria-label="경로 비교 닫기"
          onClick={onBack}
          className={ROUND_BUTTON_CLASS}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
            <path d="M19 12H5m6-6-6 6 6 6" {...stroke} />
          </svg>
        </button>
        <button
          type="button"
          aria-label="출발지와 목적지 바꾸기"
          onClick={onSwap}
          className={`${ROUND_BUTTON_CLASS} text-gray-500`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
            <path d="M8 4v13M5 14l3 3 3-3M16 20V7M13 10l3-3 3 3" {...stroke} strokeWidth={1.8} />
          </svg>
        </button>
      </div>

      <div className="pointer-events-auto min-w-0 flex-1 rounded-2xl bg-surface p-1 shadow-md">
        <button
          type="button"
          onClick={onEditStart}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left transition-[background-color] duration-75 active:bg-gray-100"
        >
          <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center">
            <span className="h-3.5 w-3.5 rounded-full border-[2.5px] border-primary" />
          </span>
          <span className="truncate text-[15px] text-gray-900">{startLabel}</span>
        </button>
        <div className="mx-3 h-px bg-gray-100" />
        <button
          type="button"
          onClick={onEditDestination}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left transition-[background-color] duration-75 active:bg-gray-100"
        >
          <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center">
            <span className="h-3 w-3 rounded-[3px] bg-gray-800" />
          </span>
          <span className="truncate text-[15px] text-gray-900">{destinationLabel}</span>
        </button>
      </div>

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
