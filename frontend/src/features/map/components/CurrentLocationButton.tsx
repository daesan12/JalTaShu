import { MAP_ROUND_BUTTON_CLASS } from '@/features/map/lib/controlStyles';

interface CurrentLocationButtonProps {
  onClick: () => void;
  /** 위치 조회 중 — 연타를 막고 조회가 돌고 있다는 것을 보여준다 */
  loading?: boolean;
  /** 하나의 지도 도구 막대 안에 배치할 때의 시각 스타일 */
  inDock?: boolean;
}

/** 현재 위치로 지도를 옮기는 버튼 */
export function CurrentLocationButton({ onClick, loading = false, inDock = false }: CurrentLocationButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label="현재 위치로 이동"
      aria-busy={loading}
      className={
        inDock
          ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-muted transition-[color,background-color,scale] duration-150 active:scale-95 active:bg-surface-soft active:text-ink disabled:pointer-events-none disabled:opacity-50'
          : MAP_ROUND_BUTTON_CLASS
      }
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`}
      >
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth={1.8} />
        <path
          d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
