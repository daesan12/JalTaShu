import type { StationForecastPoint } from '@/shared/api/types';
import { formatBikes } from '@/features/map/lib/bikeCount';
import {
  STATION_STATUS_LABEL,
  type StationStatus,
} from '@/shared/ui/stationStatus';
import { toForecastTimeline } from '@/features/map/lib/stationForecastTimeline';

/**
 * 대여소 예상 대수 (2-1) — 현재·5·10·15분 타임라인.
 *
 * 색은 대여소 마커·뱃지와 **같은 여유/보통/부족 판정**을 쓴다(`toStationStatus`).
 * 화면마다 다른 색을 쓰면 같은 숫자가 다르게 읽힌다. 기준값이 바뀌면 그 함수만 고치면 된다.
 * 확률은 표시하지 않는다(기존 결정) — 대수와 상태만.
 *
 * 예측값은 소수로 오며 반올림하지 않는다. 값이 없는 시점도 다른 값으로 채우지 않고
 * `정보 없음`으로 남겨 실제 응답 범위를 그대로 전달한다.
 */

const STATUS_DOT_CLASS: Record<StationStatus, string> = {
  high: 'border-status-high bg-status-high',
  mid: 'border-status-mid bg-status-mid',
  low: 'border-status-low bg-status-low',
  unknown: 'border-gray-300 bg-surface',
};

const STATUS_TEXT_CLASS: Record<StationStatus, string> = {
  high: 'text-status-high',
  mid: 'text-status-mid',
  low: 'text-status-low',
  unknown: 'text-gray-400',
};

interface StationForecastChartProps {
  points: StationForecastPoint[];
  /** 현재 대수. 모르면 null */
  currentBikes: number | null;
}

export function StationForecastChart({ points, currentBikes }: StationForecastChartProps) {
  const timeline = toForecastTimeline(points, currentBikes);

  return (
    <ol aria-label="현재와 향후 예상 자전거 수" className="relative grid grid-cols-4 gap-1.5">
      <span
        aria-hidden="true"
        className="absolute top-[2.15rem] right-[12.5%] left-[12.5%] h-0.5 bg-gray-200"
      />
      {timeline.map((item) => (
        <li key={item.horizon} className="relative flex min-w-0 flex-col items-center text-center">
          <span className="text-xs font-medium text-gray-500">{item.label}</span>
          <span
            aria-hidden="true"
            className={`z-10 mt-2 h-3 w-3 rounded-full border-2 ${STATUS_DOT_CLASS[item.status]}`}
          />
          <span className="mt-2 whitespace-nowrap text-lg font-bold tabular-nums text-gray-900">
            {item.bikes === null ? '–' : `${formatBikes(item.bikes)}대`}
          </span>
          <span
            className={`mt-0.5 whitespace-nowrap text-[11px] font-semibold ${STATUS_TEXT_CLASS[item.status]}`}
          >
            {item.bikes === null ? '정보 없음' : STATION_STATUS_LABEL[item.status]}
          </span>
        </li>
      ))}
    </ol>
  );
}
