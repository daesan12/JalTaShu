import type { StationForecastPoint } from '@/shared/api/types';
import { toStationStatus, type StationStatus } from '@/shared/ui/stationStatus';

const SHORT_HORIZONS = [0, 5, 10, 15] as const;
const HOUR_HORIZONS = [0, 5, 10, 15, 30, 45, 60] as const;

export interface StationForecastTimelineItem {
  horizon: number;
  label: string;
  bikes: number | null;
  status: StationStatus;
}

function formatHorizon(horizon: number): string {
  if (horizon === 0) return '현재';
  if (horizon === 60) return '1시간';
  return `${horizon}분`;
}

/**
 * 1분 단위 응답에서 화면에 쓸 대표 시점만 고른다.
 * 현재 15분 응답은 기존 네 시점을 유지하고, 서버가 60분치로 확장되면
 * 초기 15분은 촘촘하게, 이후는 15분 간격으로 한 시간까지 보여준다.
 */
export function toForecastTimeline(
  points: StationForecastPoint[],
  currentBikes: number | null,
): StationForecastTimelineItem[] {
  const horizons = points.length > 15 ? HOUR_HORIZONS : SHORT_HORIZONS;

  return horizons.map((horizon) => {
    const bikes = horizon === 0 ? currentBikes : (points[horizon - 1]?.bikeCnt ?? null);
    return {
      horizon,
      label: formatHorizon(horizon),
      bikes,
      status: toStationStatus(bikes),
    };
  });
}
