import type { StationForecastPoint } from '@/shared/api/types';
import { toStationStatus, type StationStatus } from '@/shared/ui/stationStatus';

const HORIZONS = [0, 5, 10, 15] as const;

export interface StationForecastTimelineItem {
  horizon: (typeof HORIZONS)[number];
  label: string;
  bikes: number | null;
  status: StationStatus;
}

/** 1분 단위 응답에서 화면에 쓸 현재·5·10·15분 값만 고른다. */
export function toForecastTimeline(
  points: StationForecastPoint[],
  currentBikes: number | null,
): StationForecastTimelineItem[] {
  return HORIZONS.map((horizon) => {
    const bikes = horizon === 0 ? currentBikes : (points[horizon - 1]?.bikeCnt ?? null);
    return {
      horizon,
      label: horizon === 0 ? '현재' : `${horizon}분`,
      bikes,
      status: toStationStatus(bikes),
    };
  });
}
