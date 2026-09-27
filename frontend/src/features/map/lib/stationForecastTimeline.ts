import type { StationForecastPoint } from '@/shared/api/types';
import { toStationStatus, type StationStatus } from '@/shared/ui/stationStatus';

const SHORT_HORIZONS = [0, 5, 10, 15] as const;
const HOUR_HORIZONS = [0, 5, 10, 15, 30, 45, 60] as const;
/**
 * 현재보다 이만큼 이상 줄어야 "가장 적을 때"를 짚는다(#154). 0.1대 차이로 5분을 짚으면
 * 늘어나는 대여소에서도 줄어드는 것처럼 읽혀서다
 */
export const MEANINGFUL_DROP_BIKES = 1;

export interface StationForecastTimelineItem {
  horizon: number;
  label: string;
  bikes: number | null;
  status: StationStatus;
  /** 그 시점의 벽시계 시각("16:42"). 현재(0분)와 값이 빠진 시점은 null */
  clock: string | null;
}

function formatHorizon(horizon: number): string {
  if (horizon === 0) return '현재';
  if (horizon === 60) return '1시간';
  return `${horizon}분`;
}

/**
 * 예측 시각을 "16:42"로. 기기 표준시가 아니라 **Asia/Seoul로 고정**한다 —
 * 대여소가 대전에 있으니 기기를 다른 표준시로 맞춰 둔 사용자에게도 현지 시각이 맞아야 한다.
 * 로케일을 en-GB로 두는 것은 24시간 표기를 확실히 얻기 위해서다(ko-KR은 환경에 따라 24시를 쓴다).
 */
function formatClock(iso: string | undefined): string | null {
  if (iso === undefined) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(at);
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
    const point = horizon === 0 ? undefined : points[horizon - 1];
    const bikes = horizon === 0 ? currentBikes : (point?.bikeCnt ?? null);
    return {
      horizon,
      label: formatHorizon(horizon),
      bikes,
      status: toStationStatus(bikes),
      clock: formatClock(point?.dateTime),
    };
  });
}

/**
 * 다이얼에서 고를 수 있는 시점 중 대수가 가장 적은 때.
 *
 * 현재(0분)는 빼고 본다 — 앞으로 위험해지는 때를 미리 알리는 줄이라 지금 값은 답이 될 수 없다.
 * 같은 값이 여러 번이면 먼저 오는 쪽을 고른다(먼저 닥치는 쪽이 사용자에게 급하다).
 *
 * 응답 전체(1분 단위 60개)가 아니라 **대표 시점만** 본다. 다이얼이 짚을 수 없는 37분을
 * "가장 적을 때"라고 알려 주면 확인하러 갈 수가 없어, 안내와 화면이 어긋난다.
 */
export function findLowestUpcoming(
  timeline: StationForecastTimelineItem[],
): StationForecastTimelineItem | null {
  let lowest: StationForecastTimelineItem | null = null;
  let lowestBikes = Number.POSITIVE_INFINITY;

  for (const item of timeline) {
    if (item.horizon === 0 || item.bikes === null) continue;
    if (item.bikes < lowestBikes) {
      lowest = item;
      lowestBikes = item.bikes;
    }
  }

  return lowest;
}

export type LowestUpcomingHint =
  { kind: 'drop'; item: StationForecastTimelineItem } | { kind: 'steady' };

/**
 * "가장 적을 때" 안내에 쓸 내용(#154). 현재보다 `MEANINGFUL_DROP_BIKES` 이상 줄어드는 시점이 있을 때만
 * 그 시점을 짚고, 없으면 크게 줄지 않는다고 알린다. 현재 대수를 모르거나 앞으로의 값이 없으면
 * 비교할 수 없어 null(안내를 숨긴다).
 */
export function describeLowestUpcoming(
  timeline: StationForecastTimelineItem[],
): LowestUpcomingHint | null {
  const current = timeline.find((item) => item.horizon === 0)?.bikes ?? null;
  const lowest = findLowestUpcoming(timeline);
  if (current === null || lowest === null || lowest.bikes === null) return null;
  return current - lowest.bikes >= MEANINGFUL_DROP_BIKES
    ? { kind: 'drop', item: lowest }
    : { kind: 'steady' };
}
