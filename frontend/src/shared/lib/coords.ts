/**
 * 좌표 변환 공용 유틸.
 * OSRM(GeoJSON)은 [경도, 위도] 순서, 네이버 지도는 (위도, 경도) 순서라서
 * 반드시 이 함수로만 변환한다. (순서 뒤집힘이 지도 버그 1순위 원인)
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** OSRM geometry 좌표 1개 [lng, lat] → {lat, lng} */
export function osrmToLatLng([lng, lat]: [number, number]): LatLng {
  return { lat, lng };
}

/** OSRM geometry 좌표 배열 → {lat, lng} 배열 (경로선 그리기용) */
export function osrmPathToLatLngs(coords: [number, number][]): LatLng[] {
  return coords.map(osrmToLatLng);
}

/** {lat, lng} → OSRM 요청용 "lng,lat" 문자열 */
export function latLngToOsrmParam({ lat, lng }: LatLng): string {
  return `${lng},${lat}`;
}

/** 지구 반지름 (m) */
const EARTH_RADIUS_M = 6_371_000;

/**
 * 실제 보행 경로는 건물을 돌아가느라 직선보다 30%쯤 길다는 도시 보행 경험값.
 * 강·철도로 막힌 구간은 이 보정으로도 부족하다.
 */
const WALK_DETOUR_FACTOR = 1.3;

/** 도보 속도 (m/분) — 4km/h 기준 */
const WALK_SPEED_M_PER_MIN = 67;

/** 두 좌표 사이 직선거리 (m) — Haversine */
export function distanceInMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * 두 좌표 사이 도보 시간 (분). 직선거리 기반 **추정치**라 화면에는 "약 N분"으로 표시할 것.
 * 강·철도로 막힌 구간은 실제보다 짧게 나온다.
 * 정확한 값이 필요한 경로 화면(09~11)은 백엔드 `/map/path`의 실제 경로를 쓴다.
 */
export function walkMinutesBetween(a: LatLng, b: LatLng): number {
  const meters = distanceInMeters(a, b) * WALK_DETOUR_FACTOR;
  // 바로 앞 대여소가 "0분"으로 나오지 않도록 최소 1분
  return Math.max(1, Math.round(meters / WALK_SPEED_M_PER_MIN));
}
