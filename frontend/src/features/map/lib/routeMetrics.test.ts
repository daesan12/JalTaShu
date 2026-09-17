import { describe, expect, it } from 'vitest';
import type { RouteSummary } from '@/features/map/lib/routeMetrics';
import {
  formatSecondsAsMinutes,
  sortSummaries,
  summarizeRoute,
  totalAscent,
} from '@/features/map/lib/routeMetrics';
import { makeLeg, makeRoute } from '@/features/map/lib/__fixtures__/route';

/** 고도만 다르게 준 한 구간짜리 경로 */
function routeWithAltitudes(altitudes: number[]) {
  return makeRoute({
    legs: [makeLeg('BICYCLE', 0, altitudes.length - 1, 1000, 300, altitudes)],
  });
}

describe('totalAscent', () => {
  it('올라가는 구간만 더하고 내려가는 구간은 세지 않는다', () => {
    expect(totalAscent(routeWithAltitudes([50, 70, 60, 90, 40]))).toBe(50); // +20, +30
    expect(totalAscent(routeWithAltitudes([50, 50]))).toBe(0);
  });

  it('구간 경계 좌표를 두 번 세지 않는다', () => {
    // 좌표 11개가 0m에서 100m까지 10m씩 오른다 — 구간이 3개로 나뉘어도 총 상승은 100m
    const climbing = Array.from({ length: 11 }, (_, i) => i * 10);
    expect(totalAscent(makeRoute({ altitudes: climbing }))).toBe(100);
  });
});

describe('summarizeRoute', () => {
  it('서버가 준 총 시간·종류를 그대로 쓰고 도보 시간만 따로 더한다', () => {
    const summary = summarizeRoute(makeRoute({ type: 'UPHILL' }), 2);
    expect(summary).toEqual({
      index: 2,
      type: 'UPHILL',
      totalSec: 500, // 150 + 200 + 150
      walkSec: 300, // 도보 두 구간
      ascentM: 0, // 기본 고정 데이터는 평지
      expectedBikeCnt: undefined,
    });
  });

  it('예상 대수는 아직 응답에 없어 undefined다 — 값이 오면 그대로 담는다', () => {
    expect(summarizeRoute(makeRoute(), 0).expectedBikeCnt).toBeUndefined();
    expect(summarizeRoute(makeRoute({ expectedBikeCnt: 4 }), 0).expectedBikeCnt).toBe(4);
  });

  it('거리 0인 구간은 도보 시간에 넣지 않는다', () => {
    expect(summarizeRoute(makeRoute({ distances: [0, 538, 179] }), 0).walkSec).toBe(150);
  });
});

describe('sortSummaries', () => {
  const summaries: RouteSummary[] = [
    { index: 0, type: 'BIKE', totalSec: 1260, walkSec: 540, ascentM: 72, expectedBikeCnt: 1 },
    { index: 1, type: 'UPHILL', totalSec: 1380, walkSec: 540, ascentM: 45, expectedBikeCnt: 4 },
    { index: 2, type: 'BIKE', totalSec: 1560, walkSec: 600, ascentM: 18, expectedBikeCnt: 3 },
    { index: 3, type: 'UPHILL', totalSec: 1500, walkSec: 300, ascentM: 60, expectedBikeCnt: 4 },
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

  it('예상 대수가 아직 없으면 전부 동률이라 빠른 순으로 떨어진다', () => {
    const pending = summaries.map((s) => ({ ...s, expectedBikeCnt: undefined }));
    expect(sortSummaries(pending, ['bikes']).map((s) => s.index)).toEqual([0, 1, 3, 2]);
  });

  it('둘 다 켜면 확보 우선으로 줄 세우고 동률은 오르막 적은 쪽이 앞', () => {
    const tieBreak: RouteSummary[] = [
      { index: 0, type: 'BIKE', totalSec: 1000, walkSec: 100, ascentM: 80, expectedBikeCnt: 4 },
      { index: 1, type: 'UPHILL', totalSec: 1400, walkSec: 100, ascentM: 20, expectedBikeCnt: 4 },
    ];
    // bikes만이면 빠른 0번이 앞, flat이 동점 처리에 끼면 오르막 적은 1번이 앞
    expect(sortSummaries(tieBreak, ['bikes']).map((s) => s.index)).toEqual([0, 1]);
    expect(sortSummaries(tieBreak, ['bikes', 'flat']).map((s) => s.index)).toEqual([1, 0]);
  });
});

describe('formatSecondsAsMinutes', () => {
  it('반올림하고 1분 미만은 1분', () => {
    expect(formatSecondsAsMinutes(1260)).toBe('21분');
    expect(formatSecondsAsMinutes(1290)).toBe('22분');
    expect(formatSecondsAsMinutes(10)).toBe('1분');
  });
});
