/** 대여소 잔여 상태 — Figma StatusBadge·StationMarker 변형(여유/보통/부족)과 1:1 */
export type StationStatus = 'high' | 'mid' | 'low';

export const STATION_STATUS_LABEL: Record<StationStatus, string> = {
  high: '여유',
  mid: '보통',
  low: '부족',
};

/** 잔여 대수 → 상태 (기준값은 추후 정책 확정 시 조정) */
export function toStationStatus(bikes: number): StationStatus {
  if (bikes >= 5) return 'high';
  if (bikes >= 2) return 'mid';
  return 'low';
}
