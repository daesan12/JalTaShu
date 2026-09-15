import { describe, expect, it } from 'vitest';
import type { RoutePath } from '@/shared/api/types';
import { getRouteProgress, hasArrived, legInstruction } from '@/features/map/lib/routeProgress';

/**
 * 위도 36.35에서 경도 0.001도 ≈ 89.6m.
 * 좌표 11개를 일직선으로 놓아 전체 길이 ≈ 896m인 경로를 만든다.
 */
const POINTS = Array.from({ length: 11 }, (_, i) => ({ xPos: 127 + i * 0.001, yPos: 36.35 }));

function route(partial: Partial<RoutePath> = {}): RoutePath {
  return {
    // 도보 200m → 자전거 600m → 도보 200m (합 1000m, 비율만 쓰인다)
    distance: [200, 600, 200],
    time: [150, 200, 150],
    behave: ['WALK', 'BIKE', 'WALK'],
    location: POINTS,
    altitude: [],
    expectedBikeCnt: 3,
    ...partial,
  };
}

describe('getRouteProgress', () => {
  it('위치를 모르면 출발 상태로 본다', () => {
    const progress = getRouteProgress(route(), null);
    expect(progress.legIndex).toBe(0);
    expect(progress.leg?.behave).toBe('WALK');
    expect(progress.ratio).toBe(0);
    expect(progress.remainingM).toBeGreaterThan(800);
  });

  it('출발점 근처에서는 첫 도보 구간', () => {
    const progress = getRouteProgress(route(), { xPos: 127.0005, yPos: 36.35 });
    expect(progress.legIndex).toBe(0);
    expect(progress.leg?.behave).toBe('WALK');
  });

  it('가운데에서는 자전거 구간', () => {
    const progress = getRouteProgress(route(), { xPos: 127.005, yPos: 36.35 });
    expect(progress.legIndex).toBe(1);
    expect(progress.leg?.behave).toBe('BIKE');
  });

  it('도착 근처에서는 마지막 도보 구간이고 남은 거리가 0에 가깝다', () => {
    const progress = getRouteProgress(route(), { xPos: 127.01, yPos: 36.35 });
    expect(progress.legIndex).toBe(2);
    expect(progress.remainingM).toBe(0);
    expect(progress.ratio).toBe(1);
  });

  it('경로를 벗어나도 가장 가까운 지점으로 붙는다', () => {
    // 경로에서 북쪽으로 떨어진 지점 — 경도상 가운데
    const progress = getRouteProgress(route(), { xPos: 127.005, yPos: 36.36 });
    expect(progress.legIndex).toBe(1);
  });

  it('진행할수록 남은 거리가 줄어든다', () => {
    const start = getRouteProgress(route(), { xPos: 127.001, yPos: 36.35 });
    const later = getRouteProgress(route(), { xPos: 127.007, yPos: 36.35 });
    expect(later.remainingM).toBeLessThan(start.remainingM);
    expect(later.ratio).toBeGreaterThan(start.ratio);
  });

  it('길이 0인 대여·반납 구간은 세지 않는다', () => {
    const withRent = route({
      distance: [200, 0, 600, 0, 200],
      time: [150, 0, 200, 0, 150],
      behave: ['WALK', 'RENT', 'BIKE', 'RETURN', 'WALK'],
    });
    const progress = getRouteProgress(withRent, { xPos: 127.005, yPos: 36.35 });
    expect(progress.leg?.behave).toBe('BIKE');
  });

  it('좌표가 모자라면 빈 결과', () => {
    const progress = getRouteProgress(route({ location: [POINTS[0]] }), null);
    expect(progress.legIndex).toBe(-1);
    expect(progress.leg).toBeNull();
  });
});

describe('hasArrived', () => {
  it('목적지 근처(30m 이내)면 도착으로 본다', () => {
    const progress = getRouteProgress(route(), { xPos: 127.01, yPos: 36.35 });
    expect(hasArrived(progress)).toBe(true);
  });

  it('아직 멀면 도착이 아니다', () => {
    const progress = getRouteProgress(route(), { xPos: 127.005, yPos: 36.35 });
    expect(hasArrived(progress)).toBe(false);
  });

  it('좌표가 모자란 빈 결과는 도착이 아니다', () => {
    const progress = getRouteProgress(route({ location: [POINTS[0]] }), null);
    expect(hasArrived(progress)).toBe(false);
  });
});

describe('legInstruction', () => {
  it('구간 종류와 마지막 여부로 문구를 정한다', () => {
    expect(legInstruction({ behave: 'WALK', distanceM: 200, timeSec: 150 }, false)).toBe(
      '대여소까지 걸어가세요',
    );
    expect(legInstruction({ behave: 'WALK', distanceM: 200, timeSec: 150 }, true)).toBe(
      '목적지까지 걸어가세요',
    );
    expect(legInstruction({ behave: 'BIKE', distanceM: 600, timeSec: 200 }, false)).toBe(
      '자전거로 이동하세요',
    );
    expect(legInstruction(null, false)).toBe('경로를 확인하는 중입니다');
  });
});
