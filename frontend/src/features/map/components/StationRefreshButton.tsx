import { MAP_ROUND_BUTTON_CLASS } from '@/features/map/lib/controlStyles';

interface StationRefreshButtonProps {
  onClick: () => void;
  /** 대여소 목록을 다시 받아오는 중 — 연타를 막고 아이콘을 돌린다 */
  refreshing?: boolean;
  /** 하나의 지도 도구 막대 안에 배치할 때의 시각 스타일 */
  inDock?: boolean;
  /** 갱신 시각 바로 옆에 배치하는 작은 버튼 */
  compact?: boolean;
}

/**
 * 대여소 잔여 대수를 지금 다시 받아오는 버튼 (07 현재위치 버튼 바로 위).
 * 지도는 수집 주기에 맞춰 스스로도 목록을 다시 받지만, 그 주기를 기다리지 않고 바로 받고 싶을 때 쓴다.
 * 갱신 배지가 "몇 초 전"인지 알려주고, 이 버튼이 그 값을 0초로 되돌린다.
 * 자동 갱신은 실패해도 조용하지만, 이 버튼으로 받다 실패하면 안내 문구가 뜬다.
 */
export function StationRefreshButton({
  onClick,
  refreshing = false,
  inDock = false,
  compact = false,
}: StationRefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={refreshing}
      aria-label="대여소 정보 새로고침"
      aria-busy={refreshing}
      className={
        compact
          ? 'flex h-9 w-10 shrink-0 items-center justify-center border-l border-line/80 text-muted transition-[color,background-color,transform] duration-150 hover:bg-primary-light hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none'
          : inDock
            ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-muted transition-[color,background-color,scale] duration-150 active:scale-95 active:bg-surface-soft active:text-ink disabled:pointer-events-none disabled:opacity-50'
            : MAP_ROUND_BUTTON_CLASS
      }
    >
      {/* 회전 아이콘은 10 경로 비교 화면의 "경로 다시 조회"와 같은 모양을 쓴다 */}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`}
      >
        <path
          d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
