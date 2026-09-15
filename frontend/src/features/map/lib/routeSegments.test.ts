import { describe, expect, it } from 'vitest';
import type { RoutePath } from '@/shared/api/types';
import { splitByLeg, toLegs } from '@/features/map/lib/routeSegments';

/** 좌표 n개를 경도만 늘려 만든다 — 구간 분할은 좌표 개수 비율만 보므로 값 자체는 중요하지 않다 */
function points(count: number) {
  return Array.from({ length: count }, (_, i) => ({ xPos: 127 + i * 0.001, yPos: 36.35 }));
}

function route(partial: Partial<RoutePath>): RoutePath {
  return {
    distance: [200, 600, 200],
    time: [150, 200, 150],
    behave: ['WALK', 'BIKE', 'WALK'],
    location: points(11),
    altitude: [],
    expectedBikeCnt: 3,
    ...partial,
  };
}

describe('toLegs', () => {
  it('이동이 있는 구간만 응답 순서대로 남긴다', () => {
    expect(toLegs(route({}))).toEqual([
      { behave: 'WALK', distanceM: 200, timeSec: 150 },
      { behave: 'BIKE', distanceM: 600, timeSec: 200 },
      { behave: 'WALK', distanceM: 200, timeSec: 150 },
    ]);
  });

  it('길이 0인 RENT·RETURN 구간은 뺀다', () => {
    const withRent = route({
      distance: [200, 0, 600, 0, 200],
      time: [150, 0, 200, 0, 150],
      behave: ['WALK', 'RENT', 'BIKE', 'RETURN', 'WALK'],
    });
    expect(toLegs(withRent).map((leg) => leg.behave)).toEqual(['WALK', 'BIKE', 'WALK']);
  });
});

describe('splitByLeg', () => {
  it('거리 비율대로 좌표를 나누고 경계 좌표는 양쪽이 함께 갖는다', () => {
    const legs = splitByLeg(route({}));
    expect(legs.map((leg) => leg.behave)).toEqual(['WALK', 'BIKE', 'WALK']);
    // 200/1000·800/1000 지점 → 좌표 10개 기준 인덱스 2, 8
    expect(legs[0].points).toHaveLength(3);
    expect(legs[1].points).toHaveLength(7);
    expect(legs[2].points).toHaveLength(3);
    // 앞 구간의 끝 좌표가 다음 구간의 첫 좌표 — 선이 끊겨 보이지 않게
    expect(legs[0].points.at(-1)).toEqual(legs[1].points[0]);
    expect(legs[1].points.at(-1)).toEqual(legs[2].points[0]);
  });

  it('마지막 구간은 항상 마지막 좌표까지 그린다', () => {
    const legs = splitByLeg(route({}));
    expect(legs.at(-1)?.points.at(-1)).toEqual(points(11).at(-1));
  });

  it('좌표가 2개 미만이면 그릴 것이 없다', () => {
    expect(splitByLeg(route({ location: points(1) }))).toEqual([]);
  });

  it('거리 합이 0이면 그리지 않는다', () => {
    expect(splitByLeg(route({ distance: [0, 0, 0] }))).toEqual([]);
  });
});
