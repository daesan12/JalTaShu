import { describe, expect, it } from 'vitest';
import { latLngToOsrmParam, osrmPathToLatLngs, osrmToLatLng } from '@/shared/lib/coords';

// 좌표 순서 뒤집힘(OSRM=[경도,위도] ↔ 네이버=(위도,경도))이 지도 버그 1순위라 순서를 고정 검증한다
describe('coords', () => {
  const 대전시청_OSRM: [number, number] = [127.3848, 36.3505]; // [lng, lat]

  it('osrmToLatLng: [경도, 위도] → {lat, lng}', () => {
    expect(osrmToLatLng(대전시청_OSRM)).toEqual({ lat: 36.3505, lng: 127.3848 });
  });

  it('osrmPathToLatLngs: 경로 배열 전체를 변환한다', () => {
    const path: [number, number][] = [
      [127.1, 36.1],
      [127.2, 36.2],
    ];
    expect(osrmPathToLatLngs(path)).toEqual([
      { lat: 36.1, lng: 127.1 },
      { lat: 36.2, lng: 127.2 },
    ]);
  });

  it('latLngToOsrmParam: {lat, lng} → "lng,lat" 문자열', () => {
    expect(latLngToOsrmParam({ lat: 36.3505, lng: 127.3848 })).toBe('127.3848,36.3505');
  });

  it('변환을 왕복해도 값이 보존된다', () => {
    const back = osrmToLatLng(대전시청_OSRM);
    expect(latLngToOsrmParam(back)).toBe('127.3848,36.3505');
  });
});
