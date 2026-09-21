import { stationMarkerSizeClass } from '@/shared/ui/stationMarkerSize';
import type { StationStatus } from '@/shared/ui/stationStatus';

/**
 * Figma StationMarker 변형(State=여유/보통/부족)과 1:1.
 * 네이버 지도 커스텀 마커의 content로 쓰기 위해 DOM 구조를 단순하게 유지.
 */
const STATUS_BG: Record<StationStatus, string> = {
  high: 'bg-status-high/82',
  mid: 'bg-status-mid/82',
  low: 'bg-status-low/82',
  unknown: 'bg-gray-500/72',
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
      className={`tabular-nums flex items-center justify-center rounded-full font-bold text-white backdrop-blur-[1px] transition-[scale,box-shadow,opacity] duration-100 ${
        STATUS_BG[status]
      } ${stationMarkerSizeClass(count)} ${
        selected
          ? 'scale-110 ring-[3px] ring-white opacity-100 shadow-lg'
          : 'ring-1 ring-white/90 opacity-90 shadow-sm'
      }`}
    >
      {count ?? '-'}
    </div>
  );
}
