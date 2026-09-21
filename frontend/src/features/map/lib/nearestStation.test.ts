import { describe, expect, it } from 'vitest';
import type { BikeStation } from '@/shared/api/types';
import { RETURN_RADIUS_M, nearestStation } from '@/features/map/lib/nearestStation';

function station(stationId: string, lat: number, lng: number): BikeStation {
  return { stationId, name: stationId, lat, lng, address: null, currentBikes: 3, updatedAt: null };
}

/** 위도 1도 ≈ 111km — 미터를 도로 바꿔 가까운 좌표를 만든다 */
function latOffset(meters: number): number {
  return meters / 111_000;
}

const BASE = { lat: 36.3504, lng: 127.3845 };
const here = { xPos: BASE.lng, yPos: BASE.lat };

describe('반납할 대여소 고르기', () => {
  it('반경 안에서 가장 가까운 대여소를 고른다', () => {
    const stations = [
      station('ST002', BASE.lat + latOffset(120), BASE.lng),
      station('ST001', BASE.lat + latOffset(30), BASE.lng),
    ];
    expect(nearestStation(stations, here)?.stationId).toBe('ST001');
  });

  it('전부 반경 밖이면 고르지 않는다 — 엉뚱한 대여소에 반납되면 되돌릴 수 없다', () => {
    const far = [station('ST003', BASE.lat + latOffset(RETURN_RADIUS_M + 50), BASE.lng)];
    expect(nearestStation(far, here)).toBeNull();
  });

  it('경계(반경과 같은 거리)는 반납을 허용한다', () => {
    const edge = [station('ST004', BASE.lat + latOffset(RETURN_RADIUS_M - 1), BASE.lng)];
    expect(nearestStation(edge, here)?.stationId).toBe('ST004');
  });

  it('위치를 모르거나 목록이 없으면 고르지 않는다', () => {
    expect(nearestStation([station('ST005', BASE.lat, BASE.lng)], null)).toBeNull();
    expect(nearestStation(undefined, here)).toBeNull();
    expect(nearestStation([], here)).toBeNull();
  });

  // xPos=경도·yPos=위도를 뒤집으면 대전에서 수천 km 떨어진 좌표가 되어 아무것도 안 잡힌다
  it('좌표를 뒤집어 넣으면 아무 대여소도 걸리지 않는다', () => {
    const stations = [station('ST006', BASE.lat, BASE.lng)];
    expect(nearestStation(stations, { xPos: BASE.lat, yPos: BASE.lng })).toBeNull();
  });
});
