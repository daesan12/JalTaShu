import { MAP_ROUND_BUTTON_CLASS } from '@/features/map/lib/controlStyles';

interface StationRefreshButtonProps {
  onClick: () => void;
  /** 대여소 목록을 다시 받아오는 중 — 연타를 막고 아이콘을 돌린다 */
  refreshing?: boolean;
}

/**
 * 대여소 잔여 대수를 지금 다시 받아오는 버튼 (07 현재위치 버튼 바로 위).
 * 지도는 대여소 목록을 한 번 받아 두고 계속 보여주기 때문에, 화면을 오래 켜 두면 숫자가 오래된 값이 된다.
 * 갱신 배지가 "몇 초 전"인지 알려주고, 이 버튼이 그 값을 0초로 되돌린다.
 */
export function StationRefreshButton({ onClick, refreshing = false }: StationRefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={refreshing}
      aria-label="대여소 정보 새로고침"
      aria-busy={refreshing}
      className={MAP_ROUND_BUTTON_CLASS}
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
