import { describe, expect, it } from 'vitest';
import {
  distanceToRouteStart,
  needsRouteStartChoice,
  ROUTE_START_PROXIMITY_M,
} from '@/features/map/lib/routeStartGuard';

const START = { xPos: 127.3848, yPos: 36.3514 };

describe('routeStartGuard', () => {
  it('같은 위치에서는 바로 안내를 시작한다', () => {
    expect(distanceToRouteStart(START, START)).toBe(0);
    expect(needsRouteStartChoice(START, START)).toBe(false);
  });

  it('GPS 오차 수준인 100m 안쪽은 선택한 출발지로 인정한다', () => {
    const nearby = { xPos: START.xPos, yPos: START.yPos + 0.0005 };
    expect(distanceToRouteStart(nearby, START)).toBeLessThan(ROUTE_START_PROXIMITY_M);
    expect(needsRouteStartChoice(nearby, START)).toBe(false);
  });

  it('선택한 출발지에서 멀면 시작 방법을 다시 묻는다', () => {
    const farAway = { xPos: START.xPos, yPos: START.yPos + 0.01 };
    expect(distanceToRouteStart(farAway, START)).toBeGreaterThan(ROUTE_START_PROXIMITY_M);
    expect(needsRouteStartChoice(farAway, START)).toBe(true);
  });
});
