import { describe, expect, it } from 'vitest';
import type { BikeStation } from '@/shared/api/types';
import { nearestStationId } from '@/features/map/lib/nearestStation';

function station(stationId: string, lat: number, lng: number): BikeStation {
  return {
    stationId,
    name: `대여소 ${stationId}`,
    lat,
    lng,
    address: null,
    currentBikes: 3,
    updatedAt: null,
  };
}

/** 대전 시청 부근 */
const BASE_LAT = 36.35;
const BASE_LNG = 127.3845;
/** xPos=경도, yPos=위도 (백엔드 좌표 규칙) */
const HERE = { xPos: BASE_LNG, yPos: BASE_LAT };

describe('nearestStationId', () => {
  it('현재 위치에서 가장 가까운 대여소를 고른다', () => {
    const stations = [
      station('ST0100', BASE_LAT + 0.02, BASE_LNG),
      station('ST0200', BASE_LAT + 0.0005, BASE_LNG),
      station('ST0300', BASE_LAT - 0.01, BASE_LNG),
    ];
    expect(nearestStationId(stations, HERE)).toBe('ST0200');
  });

  it('좌표가 없는 대여소는 후보에서 뺀다', () => {
    const broken = { ...station('ST0100', BASE_LAT, BASE_LNG), lat: NaN, lng: NaN };
    const stations = [broken, station('ST0200', BASE_LAT + 0.01, BASE_LNG)];
    expect(nearestStationId(stations, HERE)).toBe('ST0200');
  });

  it('대여소를 아직 못 받았으면 null — 추정 실패를 부르는 쪽이 구분할 수 있어야 한다', () => {
    expect(nearestStationId(undefined, HERE)).toBeNull();
    expect(nearestStationId([], HERE)).toBeNull();
  });
});
