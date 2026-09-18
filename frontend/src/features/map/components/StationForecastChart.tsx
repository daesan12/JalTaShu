import type { StationForecastPoint } from '@/shared/api/types';
import {
  STATION_STATUS_LABEL,
  toStationStatus,
  type StationStatus,
} from '@/shared/ui/stationStatus';

/**
 * 대여소 예상 대수 추이 (2-1) — 시간대별 막대.
 *
 * 색은 대여소 마커·뱃지와 **같은 여유/보통/부족 판정**을 쓴다(`toStationStatus`).
 * 화면마다 다른 색을 쓰면 같은 숫자가 다르게 읽힌다. 기준값이 바뀌면 그 함수만 고치면 된다.
 * 확률은 표시하지 않는다(기존 결정) — 대수와 상태만.
 */

/** 막대 색 — index.css 토큰을 그대로 쓴다 */
const BAR_CLASS: Record<StationStatus, string> = {
  high: 'bg-status-high',
  mid: 'bg-status-mid',
  low: 'bg-status-low',
  // 예측 점은 항상 숫자라 여기까지 오지 않지만, 상태 목록이 늘면 타입이 요구한다
  unknown: 'bg-gray-400',
};

const TIME_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: false,
});

function formatTime(dateTime: string): string {
  const date = new Date(dateTime);
  return Number.isNaN(date.getTime()) ? '-' : TIME_FORMAT.format(date);
}

interface StationForecastChartProps {
  points: StationForecastPoint[];
  /** 현재 대수 — 막대 높이 기준을 현재값까지 포함해 잡는다. 모르면 null */
  currentBikes: number | null;
}

export function StationForecastChart({ points, currentBikes }: StationForecastChartProps) {
  // 0대일 때도 막대가 보이도록 최소 높이를 주고, 가장 큰 값이 꽉 차게 맞춘다
  const max = Math.max(currentBikes ?? 0, ...points.map((p) => p.bikeCnt), 1);

  return (
    <div>
      <div
        role="img"
        aria-label={`예상 대수 추이: ${points
          .map((p) => `${formatTime(p.dateTime)} ${Math.round(p.bikeCnt)}대`)
          .join(', ')}`}
        className="flex h-32 items-end gap-2"
      >
        {points.map((point) => {
          const status = toStationStatus(point.bikeCnt);
          // 예측값이라 6.8처럼 소수로 온다 — 대수는 반올림해 보여준다(막대 높이는 원래 값 그대로)
          const shown = Math.round(point.bikeCnt);
          return (
            // 칸에 h-full을 줘야 막대의 퍼센트 높이가 기준을 갖는다.
            // 기준 높이가 없는 부모에 퍼센트를 주면 0으로 계산돼 막대가 아예 안 보인다
            <div
              key={point.dateTime}
              className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
            >
              <span className="text-center text-xs font-semibold tabular-nums text-gray-500">
                {shown}
              </span>
              <div
                title={`${formatTime(point.dateTime)} · ${shown}대 (${STATION_STATUS_LABEL[status]})`}
                className={`w-full rounded-t ${BAR_CLASS[status]}`}
                // 0대도 보이도록 최소 높이를 주고, 위쪽은 숫자 자리로 비워 둔다
                style={{ height: `${Math.max(5, (point.bikeCnt / max) * 85)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2 border-t border-gray-200 pt-1.5">
        {points.map((point) => (
          <span
            key={point.dateTime}
            className="min-w-0 flex-1 text-center text-xs tabular-nums text-gray-400"
          >
            {formatTime(point.dateTime)}
          </span>
        ))}
      </div>
    </div>
  );
}
