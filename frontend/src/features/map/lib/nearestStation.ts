import type { BikeStation, Pos } from '@/shared/api/types';
import { haversineMeters, posToLatLng } from '@/shared/lib/coords';

interface NearestResult {
  station: BikeStation;
  distanceM: number;
}

function findNearest(
  stations: BikeStation[] | undefined,
  position: Pos | null,
): NearestResult | null {
  if (!stations || stations.length === 0 || position === null) return null;

  const here = posToLatLng(position);
  let result: NearestResult | null = null;

  for (const station of stations) {
    if (!Number.isFinite(station.lat) || !Number.isFinite(station.lng)) continue;
    const distanceM = haversineMeters(here, { lat: station.lat, lng: station.lng });
    // 동점이면 목록에서 먼저 만난 대여소를 유지해 결과를 고정한다.
    if (result === null || distanceM < result.distanceM) {
      result = { station, distanceM };
    }
  }

  return result;
}

/** 현재 위치에서 가장 가까운 대여소 ID. 대여 시 출발 대여소 추정에 사용한다. */
export function nearestStationId(
  stations: BikeStation[] | undefined,
  position: Pos,
): string | null {
  return findNearest(stations, position)?.station.stationId ?? null;
}

/** 현재 위치에서 가장 가까운 대여소. */
export function nearestStation(
  stations: BikeStation[] | undefined,
  position: Pos | null,
): BikeStation | null {
  return findNearest(stations, position)?.station ?? null;
}
