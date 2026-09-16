import { describe, expect, it } from 'vitest';
import type { RoutePath } from '@/shared/api/types';
import {
  assignBadges,
  formatMinutes,
  sortSummaries,
  summarizeRoute,
  totalAscent,
} from '@/features/map/lib/routeMetrics';

function route(over: Partial<RoutePath>): RoutePath {
  return {
    distance: [500, 3000, 500],
    time: [420, 720, 420],
    behave: ['WALK', 'BIKE', 'WALK'],
    location: [],
    altitude: [],
    expectedBikeCnt: 3,
    ...over,
  };
}

const alt = (values: number[]) => values.map((altitude) => ({ xPos: 0, yPos: 0, altitude }));

describe('totalAscent', () => {
  it('올라가는 구간만 더하고 내려가는 구간은 세지 않는다', () => {
    expect(totalAscent(alt([50, 70, 60, 90, 40]))).toBe(50); // +20, +30
    expect(totalAscent(alt([50]))).toBe(0);
    expect(totalAscent([])).toBe(0);
  });
});

describe('summarizeRoute', () => {
  it('총 시간과 도보 시간을 나눠 더한다. RENT/RETURN 0초 구간이 끼어도 같다', () => {
    const s = summarizeRoute(
      route({
        time: [420, 0, 720, 0, 420],
        behave: ['WALK', 'RENT', 'BIKE', 'RETURN', 'WALK'],
        altitude: alt([50, 80]),
      }),
      2,
    );
    expect(s).toEqual({ index: 2, totalSec: 1560, walkSec: 840, ascentM: 30, expectedBikeCnt: 3 });
  });
});

describe('sortSummaries', () => {
  const summaries = [
    { index: 0, totalSec: 1260, walkSec: 540, ascentM: 72, expectedBikeCnt: 1 },
    { index: 1, totalSec: 1380, walkSec: 540, ascentM: 45, expectedBikeCnt: 4 },
    { index: 2, totalSec: 1560, walkSec: 600, ascentM: 18, expectedBikeCnt: 3 },
    { index: 3, totalSec: 1500, walkSec: 300, ascentM: 60, expectedBikeCnt: 4 },
  ];

  it('확보 우선: 대수 많은 순, 같으면 빠른 순. 원본은 건드리지 않는다', () => {
    expect(sortSummaries(summaries, ['bikes']).map((s) => s.index)).toEqual([1, 3, 2, 0]);
    expect(summaries[0].index).toBe(0);
  });

  it('오르막 적게: 누적 상승 적은 순', () => {
    expect(sortSummaries(summaries, ['flat']).map((s) => s.index)).toEqual([2, 1, 3, 0]);
  });

  it('아무 칩도 없으면 빠른 순', () => {
    expect(sortSummaries(summaries, []).map((s) => s.index)).toEqual([0, 1, 3, 2]);
  });

  it('둘 다 켜면 확보 우선으로 줄 세우고 동률(1·3번)은 오르막 적은 쪽이 앞', () => {
    // bikes만일 때는 동률을 시간으로 갈라 [1, 3, ...]이지만, flat이 동점 처리에 끼면 45m < 60m로 1번이 앞
    expect(sortSummaries(summaries, ['bikes', 'flat']).map((s) => s.index)).toEqual([1, 3, 2, 0]);
    const tieBreak = [
      { index: 0, totalSec: 1000, walkSec: 100, ascentM: 80, expectedBikeCnt: 4 },
      { index: 1, totalSec: 1400, walkSec: 100, ascentM: 20, expectedBikeCnt: 4 },
    ];
    // bikes만이면 빠른 0번이 앞, flat이 동점 처리면 오르막 적은 1번이 앞
    expect(sortSummaries(tieBreak, ['bikes']).map((s) => s.index)).toEqual([0, 1]);
    expect(sortSummaries(tieBreak, ['bikes', 'flat']).map((s) => s.index)).toEqual([1, 0]);
  });
});

describe('assignBadges', () => {
  it('후보 4개면 뱃지 4개가 서로 다른 후보에게 간다', () => {
    const badges = assignBadges([
      { index: 0, totalSec: 1260, walkSec: 540, ascentM: 72, expectedBikeCnt: 1 },
      { index: 1, totalSec: 1380, walkSec: 540, ascentM: 45, expectedBikeCnt: 4 },
      { index: 2, totalSec: 1560, walkSec: 600, ascentM: 18, expectedBikeCnt: 3 },
      { index: 3, totalSec: 1500, walkSec: 300, ascentM: 60, expectedBikeCnt: 6 },
    ]);
    expect(badges).toEqual(['fast', 'walk', 'flat', 'bikes']);
  });

  it('한 후보가 여러 기준에서 1등이면 앞 순서 뱃지만 받고 나머지는 다음 후보에게 넘어간다', () => {
    const badges = assignBadges([
      { index: 0, totalSec: 1000, walkSec: 100, ascentM: 10, expectedBikeCnt: 9 }, // 전부 1등
      { index: 1, totalSec: 1200, walkSec: 200, ascentM: 20, expectedBikeCnt: 5 },
    ]);
    expect(badges).toEqual(['fast', 'bikes']);
  });

  it('동점이면 앞 인덱스가 받는다', () => {
    const same = { totalSec: 1000, walkSec: 100, ascentM: 10, expectedBikeCnt: 3 };
    expect(
      assignBadges([
        { index: 0, ...same },
        { index: 1, ...same },
      ]),
    ).toEqual(['fast', 'bikes']);
  });

  it('후보가 없으면 빈 배열', () => {
    expect(assignBadges([])).toEqual([]);
  });
});

describe('formatMinutes', () => {
  it('반올림하고 1분 미만은 1분', () => {
    expect(formatMinutes(1260)).toBe('21분');
    expect(formatMinutes(1290)).toBe('22분');
    expect(formatMinutes(10)).toBe('1분');
  });
});
