import { describe, expect, it } from 'vitest';
import { getRouteProgress, legInstruction } from '@/features/map/lib/routeProgress';
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

  it('구간 하한을 주면 위치가 출발점이어도 그 구간부터 본다 — 대여·반납 성공 뒤 GPS가 틀려도 넘어간다', () => {
    const start = { xPos: 127.0005, yPos: 36.35 };
    const riding = getRouteProgress(makeRoute(), start, 1);
    expect(riding.legIndex).toBe(1);
    expect(riding.leg?.mode).toBe('BICYCLE');
    const lastWalk = getRouteProgress(makeRoute(), null, 2);
    expect(lastWalk.legIndex).toBe(2);
    expect(lastWalk.remainingM).toBeLessThan(200);
  });

  it('위치가 하한보다 앞서 있으면 위치를 따른다', () => {
    const nearEnd = { xPos: 127.0095, yPos: 36.35 };
    expect(getRouteProgress(makeRoute(), nearEnd, 1).legIndex).toBe(2);
  });

  it('좌표가 모자라면 빈 결과', () => {
    const route = makeRoute({ legs: [makeLeg('WALK', 0, 0, 100, 60)] });
    const progress = getRouteProgress(route, null);
    expect(progress.legIndex).toBe(-1);
    expect(progress.leg).toBeNull();
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
