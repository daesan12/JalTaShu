import { describe, expect, it } from 'vitest';
import type { BikeStation } from '@/shared/api/types';
import {
  CYCLE_STATION_RADIUS_M,
  nearestStation,
  nearestStationId,
} from '@/features/map/lib/nearestStation';

function station(stationId: string, lat: number, lng: number): BikeStation {
  return { stationId, name: stationId, lat, lng, address: null, currentBikes: 3, updatedAt: null };
}

function latOffset(meters: number): number {
  return meters / 111_000;
}

const BASE = { lat: 36.3504, lng: 127.3845 };
const here = { xPos: BASE.lng, yPos: BASE.lat };

describe('nearestStationId', () => {
  it('현재 위치에서 가장 가까운 대여소를 고른다', () => {
    const stations = [
      station('ST002', BASE.lat + latOffset(120), BASE.lng),
      station('ST001', BASE.lat + latOffset(30), BASE.lng),
    ];
    expect(nearestStationId(stations, here)).toBe('ST001');
  });

  it('좌표가 유효하지 않은 대여소는 후보에서 제외한다', () => {
    const stations = [
      station('BROKEN', Number.NaN, Number.NaN),
      station('ST001', BASE.lat + latOffset(30), BASE.lng),
    ];
    expect(nearestStationId(stations, here)).toBe('ST001');
  });

  it('대여소 목록이 없으면 null을 반환한다', () => {
    expect(nearestStationId(undefined, here)).toBeNull();
    expect(nearestStationId([], here)).toBeNull();
  });
});

describe('반납 대여소 고르기', () => {
  it('반경 안에서 가장 가까운 대여소를 고른다', () => {
    const stations = [
      station('ST002', BASE.lat + latOffset(120), BASE.lng),
      station('ST001', BASE.lat + latOffset(30), BASE.lng),
    ];
    expect(nearestStation(stations, here)?.stationId).toBe('ST001');
  });

  it('모든 대여소가 반경 밖이면 null을 반환한다', () => {
    const far = [station('ST003', BASE.lat + latOffset(CYCLE_STATION_RADIUS_M + 50), BASE.lng)];
    expect(nearestStation(far, here)).toBeNull();
  });

  it('반경 경계 안의 대여소는 반납을 허용한다', () => {
    const edge = [station('ST004', BASE.lat + latOffset(CYCLE_STATION_RADIUS_M - 1), BASE.lng)];
    expect(nearestStation(edge, here)?.stationId).toBe('ST004');
  });

  it('위치나 목록이 없으면 null을 반환한다', () => {
    expect(nearestStation([station('ST005', BASE.lat, BASE.lng)], null)).toBeNull();
    expect(nearestStation(undefined, here)).toBeNull();
    expect(nearestStation([], here)).toBeNull();
  });

  it('경도와 위도를 뒤집어 넣으면 반경 내 대여소를 찾지 못한다', () => {
    const stations = [station('ST006', BASE.lat, BASE.lng)];
    expect(nearestStation(stations, { xPos: BASE.lat, yPos: BASE.lng })).toBeNull();
  });
});
