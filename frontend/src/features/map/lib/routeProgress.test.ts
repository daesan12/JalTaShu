import { describe, expect, it } from 'vitest';
import { getRouteProgress, hasArrived, legInstruction } from '@/features/map/lib/routeProgress';
import { makeLeg, makeRoute } from '@/features/map/lib/__fixtures__/route';

/**
 * 고정 데이터는 좌표 11개짜리 일직선(전체 ≈ 896m)이고 구간 경계는 좌표 2·8번이다.
 * 즉 도보 ≈ 179m → 자전거 ≈ 538m → 도보 ≈ 179m.
 */

describe('getRouteProgress', () => {
  it('위치를 모르면 출발 상태로 본다', () => {
    const progress = getRouteProgress(makeRoute(), null);
    expect(progress.legIndex).toBe(0);
    expect(progress.leg?.mode).toBe('WALK');
    expect(progress.ratio).toBe(0);
    expect(progress.remainingM).toBeGreaterThan(800);
  });

  it('출발점 근처에서는 첫 도보 구간', () => {
    const progress = getRouteProgress(makeRoute(), { xPos: 127.0005, yPos: 36.35 });
    expect(progress.legIndex).toBe(0);
    expect(progress.leg?.mode).toBe('WALK');
  });

  it('가운데에서는 자전거 구간', () => {
    const progress = getRouteProgress(makeRoute(), { xPos: 127.005, yPos: 36.35 });
    expect(progress.legIndex).toBe(1);
    expect(progress.leg?.mode).toBe('BICYCLE');
  });

  it('구간 경계는 서버가 나눠 준 좌표 그대로다 — 거리 비율로 추정하지 않는다', () => {
    // 대여소는 좌표 2번. 그 앞 좌표에 붙어 있으면 아직 도보, 대여소 좌표에 닿으면 자전거 구간이 시작된다
    expect(getRouteProgress(makeRoute(), { xPos: 127.0014, yPos: 36.35 }).legIndex).toBe(0);
    expect(getRouteProgress(makeRoute(), { xPos: 127.002, yPos: 36.35 }).legIndex).toBe(1);
  });

  it('도착 근처에서는 마지막 도보 구간이고 남은 거리가 0이다', () => {
    const progress = getRouteProgress(makeRoute(), { xPos: 127.01, yPos: 36.35 });
    expect(progress.legIndex).toBe(2);
    expect(progress.remainingM).toBe(0);
    expect(progress.ratio).toBe(1);
  });

  it('경로를 벗어나도 가장 가까운 지점으로 붙는다', () => {
    const progress = getRouteProgress(makeRoute(), { xPos: 127.005, yPos: 36.36 });
    expect(progress.legIndex).toBe(1);
  });

  it('진행할수록 남은 거리가 줄어든다', () => {
    const start = getRouteProgress(makeRoute(), { xPos: 127.001, yPos: 36.35 });
    const later = getRouteProgress(makeRoute(), { xPos: 127.007, yPos: 36.35 });
    expect(later.remainingM).toBeLessThan(start.remainingM);
    expect(later.ratio).toBeGreaterThan(start.ratio);
  });

  it('좌표가 모자라면 빈 결과', () => {
    const route = makeRoute({ legs: [makeLeg('WALK', 0, 0, 100, 60)] });
    const progress = getRouteProgress(route, null);
    expect(progress.legIndex).toBe(-1);
    expect(progress.leg).toBeNull();
  });
});

describe('hasArrived', () => {
  it('목적지 근처(30m 이내)면 도착으로 본다', () => {
    expect(hasArrived(makeRoute(), { xPos: 127.01, yPos: 36.35 })).toBe(true);
  });

  it('경로 위에 있어도 목적지에서 멀면 도착이 아니다', () => {
    expect(hasArrived(makeRoute(), { xPos: 127.005, yPos: 36.35 })).toBe(false);
  });

  it('경로에서 아예 멀리 떨어진 위치는 도착지 쪽 끝점에 가장 가까워도 도착이 아니다 — 진행률(nearestPoint) 스냅과 무관하게 목적지까지 직선 거리로만 본다', () => {
    // 경로에서 한참 떨어진 지점(동쪽으로 약 90km) — 그래도 굳이 따지면 출발점보다는 도착점에 더 가깝다
    expect(hasArrived(makeRoute(), { xPos: 128, yPos: 36.35 })).toBe(false);
  });

  it('위치를 모르면 도착이 아니다', () => {
    expect(hasArrived(makeRoute(), null)).toBe(false);
  });

  it('구간이 없는 경로는 도착이 아니다', () => {
    const empty = makeRoute({ legs: [] });
    expect(hasArrived(empty, { xPos: 127.01, yPos: 36.35 })).toBe(false);
  });
});

describe('legInstruction', () => {
  it('구간 종류와 마지막 여부로 문구를 정한다', () => {
    const walk = makeLeg('WALK', 0, 2, 179, 150);
    const bike = makeLeg('BICYCLE', 2, 8, 538, 200);
    expect(legInstruction(walk, false)).toBe('대여소까지 걸어가세요');
    expect(legInstruction(walk, true)).toBe('목적지까지 걸어가세요');
    expect(legInstruction(bike, false)).toBe('자전거로 이동하세요');
    expect(legInstruction(null, false)).toBe('경로를 확인하는 중입니다');
  });
});
