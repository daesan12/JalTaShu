import { describe, expect, it } from 'vitest';
import {
  legPoints,
  routeLatLngs,
  routePoints,
  splitByLeg,
  toLegs,
} from '@/features/map/lib/routeSegments';
import { makeLeg, makeRoute, pointAt, POINT_COUNT } from '@/features/map/lib/__fixtures__/route';

describe('toLegs', () => {
  it('서버가 나눠 준 구간을 순서 그대로 쓴다', () => {
    expect(toLegs(makeRoute()).map((leg) => leg.mode)).toEqual(['WALK', 'BICYCLE', 'WALK']);
  });

  it('거리 0인 구간은 뺀다 — 목록에도 지도에도 낼 것이 없다', () => {
    const route = makeRoute({ distances: [179, 0, 179] });
    expect(toLegs(route).map((leg) => leg.mode)).toEqual(['WALK', 'WALK']);
  });
});

describe('legPoints', () => {
  it('step들을 이어 붙이되 경계에서 겹치는 좌표는 한 번만 담는다', () => {
    const leg = makeLeg('WALK', 0, 2, 179, 150);
    // step을 둘로 쪼개고 경계 좌표(1번)를 양쪽이 갖게 한다 — 실제 OSRM 응답과 같은 모양
    leg.steps = [
      { ...leg.steps[0], points: [pointAt(0), pointAt(1)] },
      { ...leg.steps[0], points: [pointAt(1), pointAt(2)] },
    ];
    expect(legPoints(leg)).toHaveLength(3);
  });
});

describe('routePoints', () => {
  it('구간 경계 좌표도 한 번만 담는다', () => {
    // 좌표 11개 — 구간 경계(2·8번)가 두 번씩 들어가면 13개가 된다
    expect(routePoints(makeRoute())).toHaveLength(POINT_COUNT);
  });

  it('지도 좌표로 바꿀 때 위도·경도가 뒤바뀌지 않는다', () => {
    expect(routeLatLngs(makeRoute())[0]).toEqual({ lat: 36.35, lng: 127 });
  });
});

describe('splitByLeg', () => {
  it('구간별 좌표를 서버가 나눠 준 경계 그대로 돌려준다', () => {
    const legs = splitByLeg(makeRoute());
    expect(legs.map(({ leg }) => leg.mode)).toEqual(['WALK', 'BICYCLE', 'WALK']);
    expect(legs[0].points).toHaveLength(3); // 0~2
    expect(legs[1].points).toHaveLength(7); // 2~8
    expect(legs[2].points).toHaveLength(3); // 8~10
  });

  it('앞 구간의 끝 좌표가 다음 구간의 첫 좌표다 — 선이 끊겨 보이지 않게', () => {
    const legs = splitByLeg(makeRoute());
    expect(legs[0].points.at(-1)).toEqual(legs[1].points[0]);
    expect(legs[1].points.at(-1)).toEqual(legs[2].points[0]);
  });

  it('마지막 구간은 마지막 좌표까지 그린다', () => {
    const legs = splitByLeg(makeRoute());
    expect(legs.at(-1)?.points.at(-1)).toEqual({ lat: 36.35, lng: 127 + (POINT_COUNT - 1) * 0.001 });
  });

  it('좌표가 2개 미만인 구간은 선을 못 그리므로 버린다', () => {
    const route = makeRoute({ legs: [makeLeg('WALK', 0, 0, 100, 60)] });
    expect(splitByLeg(route)).toEqual([]);
  });
});
