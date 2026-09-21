import type { RouteCandidate, TravelStatus } from '@/shared/api/types';
import { legPoints, toLegs } from '@/features/map/lib/routeSegments';

/**
 * 안내가 끝난 경로를 백엔드 `PathInfo`(POST /cycle/usage)로 바꾼다.
 *
 * ⚠ 보내는 건 **실제 GPS 궤적이 아니라 안내하던 경로**다. 안내 중 원시 좌표를 쌓지 않기 때문이다
 * (배터리·저장소). 그래서 "이 길로 안내받았다"는 기록이지 "이 길로 갔다"는 증거는 아니다.
 */
export interface UsagePathPoint {
  latitude: number;
  longitude: number;
  altitude: number;
  travelStatus: TravelStatus;
  seq: number;
}

/**
 * 구간 순서를 백엔드 TravelStatus로 바꾼다.
 * 자전거 구간을 기준으로 앞쪽 도보가 WALK1(대여소까지), 뒤쪽이 WALK2(목적지까지)다.
 * 자전거 구간이 없는 도보 단독 경로는 전부 WALK1으로 본다 — 반납 뒤 도보가 아니기 때문.
 */
function toTravelStatus(mode: string, seenBike: boolean): TravelStatus {
  if (mode === 'BICYCLE') return 'BIKE';
  return seenBike ? 'WALK2' : 'WALK1';
}

/**
 * 경로 좌표를 순서대로 편다. 좌표는 서버가 `[경도, 위도]`(GeoJSON)로 주므로 뒤집어 담는다 —
 * 이 프로젝트에서 좌표 뒤집힘이 1순위 버그라 변환을 이 한 곳에만 둔다.
 */
export function toUsagePath(route: RouteCandidate): UsagePathPoint[] {
  const path: UsagePathPoint[] = [];
  let seenBike = false;

  for (const leg of toLegs(route)) {
    const travelStatus = toTravelStatus(leg.mode, seenBike);
    if (leg.mode === 'BICYCLE') seenBike = true;

    for (const point of legPoints(leg)) {
      const [longitude, latitude] = point.location;
      path.push({
        latitude,
        longitude,
        altitude: point.altitude,
        travelStatus,
        seq: path.length,
      });
    }
  }
  return path;
}
