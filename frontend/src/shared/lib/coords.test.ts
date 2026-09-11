import { describe, expect, it } from 'vitest';
import {
  distanceInMeters,
  latLngToOsrmParam,
  osrmPathToLatLngs,
  osrmToLatLng,
  walkMinutesBetween,
} from '@/shared/lib/coords';

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

// 도보 시간은 서버를 거치지 않고 직선거리로 추정한다 (07 대여소 목록·마커용)
describe('도보 추정', () => {
  const 대전시청 = { lat: 36.3505, lng: 127.3848 };
  const 대전역 = { lat: 36.3315, lng: 127.4346 };

  it('distanceInMeters: 같은 좌표는 0m', () => {
    expect(distanceInMeters(대전시청, 대전시청)).toBe(0);
  });

  it('distanceInMeters: 대전시청~대전역 직선거리는 약 5km', () => {
    const m = distanceInMeters(대전시청, 대전역);
    expect(m).toBeGreaterThan(4500);
    expect(m).toBeLessThan(5500);
  });

  it('distanceInMeters: 순서를 바꿔도 같은 값', () => {
    expect(distanceInMeters(대전시청, 대전역)).toBeCloseTo(distanceInMeters(대전역, 대전시청), 6);
  });

  it('walkMinutesBetween: 코앞이어도 0분이 아니라 1분', () => {
    const 바로옆 = { lat: 36.3505, lng: 127.3849 };
    expect(walkMinutesBetween(대전시청, 바로옆)).toBe(1);
  });

  it('walkMinutesBetween: 직선 500m는 우회계수 1.3·도보 67m/분 기준 약 10분', () => {
    // 위도 0.0045도 ≈ 500m
    const 약500m = { lat: 36.3505 + 0.0045, lng: 127.3848 };
    expect(walkMinutesBetween(대전시청, 약500m)).toBe(10);
  });
});
