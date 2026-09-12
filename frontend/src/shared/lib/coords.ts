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

/** 백엔드 좌표 필드 {xPos: 경도, yPos: 위도} → {lat, lng} (대여소·장소 검색 공용) */
export function posToLatLng({ xPos, yPos }: { xPos: number; yPos: number }): LatLng {
  return { lat: yPos, lng: xPos };
}
