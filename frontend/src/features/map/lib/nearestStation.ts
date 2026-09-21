import type { BikeStation, Pos } from '@/shared/api/types';
import { haversineMeters, posToLatLng } from '@/shared/lib/coords';

/**
 * 반납으로 인정할 대여소까지의 거리(m).
 *
 * QR만 찍어 반납할 때 대여소를 물어보지 않고 **가장 가까운 대여소**로 보낸다.
 * 반경을 두는 이유는, 대여소에서 멀리 떨어진 곳에서 찍으면 엉뚱한 대여소에 반납한 기록이
 * 남기 때문이다 — 그 기록은 되돌릴 방법이 없다. 차라리 반납을 막고 안내한다.
 *
 * 150m는 도심 GPS 오차(수십 m)는 통과시키되 옆 블록 대여소는 걸러내는 값이다.
 */
export const RETURN_RADIUS_M = 150;

/** 내 위치에서 가장 가까운 대여소. 반경 밖이거나 목록이 없으면 null */
export function nearestStation(
  stations: BikeStation[] | undefined,
  position: Pos | null,
  radiusM: number = RETURN_RADIUS_M,
): BikeStation | null {
  if (stations === undefined || position === null) return null;
  const me = posToLatLng(position);

  let best: BikeStation | null = null;
  let bestDistance = Infinity;
  for (const station of stations) {
    const distance = haversineMeters(me, { lat: station.lat, lng: station.lng });
    if (distance < bestDistance) {
      best = station;
      bestDistance = distance;
    }
  }
  return bestDistance <= radiusM ? best : null;
}
