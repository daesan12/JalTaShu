import type { BikeStation, Pos } from '@/shared/api/types';
import { haversineMeters, posToLatLng } from '@/shared/lib/coords';

/**
 * 현재 위치에서 가장 가까운 대여소 id.
 *
 * 대여·반납 모두 "지금 서 있는 대여소"를 서버에 알려야 하는데, 자전거 번호만으로는 어느
 * 대여소인지 알 길이 없다 — 현재 위치로 추정한다. 대여소 목록은 이미 화면이 들고 있으므로
 * (`features/map/api/stations.ts`) 추가 요청 없이 계산된다.
 *
 * 대여·반납이 **같은 함수를 쓴다** — 두 화면이 서로 다른 대여소를 고르면 같은 자리에서
 * 빌리고 반납했는데 출발지와 도착지가 다르게 기록된다.
 *
 * 좌표가 없는 대여소(시드에 위경도가 비어 있는 행)는 후보에서 빼고, 후보가 하나도 없으면
 * null이다 — 부르는 쪽이 "추정 실패"를 구분할 수 있어야 한다.
 */
export function nearestStationId(
  stations: BikeStation[] | undefined,
  position: Pos,
): string | null {
  if (!stations || stations.length === 0) return null;

  const here = posToLatLng(position);
  let nearestId: string | null = null;
  let nearestMeters = Number.POSITIVE_INFINITY;

  for (const station of stations) {
    if (!Number.isFinite(station.lat) || !Number.isFinite(station.lng)) continue;
    const meters = haversineMeters(here, { lat: station.lat, lng: station.lng });
    // 동점이면 먼저 만난 대여소를 유지한다 — 목록 순서(stationId 오름차순)로 결과가 고정된다
    if (meters < nearestMeters) {
      nearestMeters = meters;
      nearestId = station.stationId;
    }
  }

  return nearestId;
}
