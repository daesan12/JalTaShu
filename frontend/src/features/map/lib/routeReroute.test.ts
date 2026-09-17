import { describe, expect, it } from 'vitest';
import {
  OFF_ROUTE_THRESHOLD_M,
  REROUTE_MIN_INTERVAL_MS,
  shouldReRoute,
  toTravelStatus,
} from '@/features/map/lib/routeReroute';
import { makeLeg } from '@/features/map/lib/__fixtures__/route';

describe('toTravelStatus', () => {
  const walk = makeLeg('WALK', 0, 2, 179, 150);
  const bike = makeLeg('BICYCLE', 2, 8, 538, 200);

  it('자전거 구간은 BIKE', () => {
    expect(toTravelStatus(bike, 1)).toBe('BIKE');
  });

  it('도보는 대여소 가는 길(WALK1)과 반납 뒤 목적지 가는 길(WALK2)을 구분한다', () => {
    expect(toTravelStatus(walk, 0)).toBe('WALK1');
    expect(toTravelStatus(walk, 2)).toBe('WALK2');
  });

  it('구간을 모르면 출발 상태로 본다', () => {
    expect(toTravelStatus(null, -1)).toBe('WALK1');
  });
});

describe('shouldReRoute', () => {
  const base = { offRouteM: OFF_ROUTE_THRESHOLD_M, lastAt: null, now: 1_000_000, pending: false };

  it('많이 벗어나면 다시 찾는다', () => {
    expect(shouldReRoute(base)).toBe(true);
  });

  it('GPS 오차 범위면 그대로 간다 — 흔들릴 때마다 다시 찾으면 안 된다', () => {
    expect(shouldReRoute({ ...base, offRouteM: OFF_ROUTE_THRESHOLD_M - 1 })).toBe(false);
  });

  it('이미 조회 중이면 또 보내지 않는다', () => {
    expect(shouldReRoute({ ...base, pending: true })).toBe(false);
  });

  it('방금 찾았으면 간격을 둔다', () => {
    expect(shouldReRoute({ ...base, lastAt: base.now - 1000 })).toBe(false);
    expect(shouldReRoute({ ...base, lastAt: base.now - REROUTE_MIN_INTERVAL_MS })).toBe(true);
  });
});
