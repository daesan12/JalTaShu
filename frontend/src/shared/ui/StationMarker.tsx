import type { StationStatus } from '@/shared/ui/stationStatus';

/**
 * Figma StationMarker 변형(State=여유/보통/부족)과 1:1.
 * 네이버 지도 커스텀 마커의 content로 쓰기 위해 DOM 구조를 단순하게 유지.
 */
const STATUS_BG: Record<StationStatus, string> = {
  high: 'bg-status-high',
  mid: 'bg-status-mid',
  low: 'bg-status-low',
  unknown: 'bg-gray-400',
};

interface StationMarkerProps {
  status: StationStatus;
  /** 잔여 대수. 실시간 정보가 없는 대여소는 null — 숫자 대신 '-'를 보여준다 */
  count: number | null;
  selected?: boolean;
}

export function StationMarker({ status, count, selected = false }: StationMarkerProps) {
  return (
    <div
      className={`tabular-nums flex items-center justify-center rounded-full font-bold text-white ring-2 ring-white shadow-md transition-[scale] duration-75 ${
        STATUS_BG[status]
      } ${selected ? 'h-10 w-10 scale-110 text-base' : 'h-8 w-8 text-sm'}`}
    >
      {count ?? '-'}
    </div>
  );
}
