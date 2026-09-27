import { describe, expect, it } from 'vitest';
import type { StationForecastPoint } from '@/shared/api/types';
import {
  describeLowestUpcoming,
  findLowestUpcoming,
  toForecastTimeline,
} from '@/features/map/lib/stationForecastTimeline';

function points(count: number): StationForecastPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    dateTime: new Date(Date.UTC(2026, 8, 21, 0, index + 1)).toISOString(),
    bikeCnt: index + 1,
    probOut: 0,
  }));
}

describe('toForecastTimeline', () => {
  it('1분 단위 응답에서 현재·5·10·15분 값만 고른다', () => {
    const timeline = toForecastTimeline(points(15), 8);

    expect(timeline.map(({ label, bikes }) => ({ label, bikes }))).toEqual([
      { label: '현재', bikes: 8 },
      { label: '5분', bikes: 5 },
      { label: '10분', bikes: 10 },
      { label: '15분', bikes: 15 },
    ]);
    expect(timeline.map((item) => item.status)).toEqual(['high', 'high', 'high', 'high']);
  });

  it('60분 응답이면 한 시간까지 대표 시점을 자동으로 확장한다', () => {
    const timeline = toForecastTimeline(points(60), 8);

    expect(timeline.map(({ label, bikes }) => ({ label, bikes }))).toEqual([
      { label: '현재', bikes: 8 },
      { label: '5분', bikes: 5 },
      { label: '10분', bikes: 10 },
      { label: '15분', bikes: 15 },
      { label: '30분', bikes: 30 },
      { label: '45분', bikes: 45 },
      { label: '1시간', bikes: 60 },
    ]);
  });

  it('60분 계약에서 일부 값이 빠져도 확장된 시간축을 유지한다', () => {
    expect(toForecastTimeline(points(59), 8).map((item) => item.label)).toEqual([
      '현재',
      '5분',
      '10분',
      '15분',
      '30분',
      '45분',
      '1시간',
    ]);
  });

  it('일부 시점이 빠졌을 때 마지막 값으로 채우지 않는다', () => {
    const timeline = toForecastTimeline(points(9), 3);

    expect(timeline.map((item) => item.bikes)).toEqual([3, 5, null, null]);
    expect(timeline.map((item) => item.status)).toEqual(['mid', 'high', 'unknown', 'unknown']);
  });

  it('각 시점의 벽시계 시각을 대전 기준으로 붙이고 현재는 비운다', () => {
    const timeline = toForecastTimeline(points(15), 8);

    // points()는 UTC 00:01부터 1분 간격 — 대전(UTC+9)에서는 09:01부터다
    expect(timeline.map((item) => item.clock)).toEqual([null, '09:05', '09:10', '09:15']);
  });

  it('현재값과 예측값이 모두 없으면 네 시점을 정보 없음으로 둔다', () => {
    const timeline = toForecastTimeline([], null);

    expect(timeline).toHaveLength(4);
    expect(timeline.every((item) => item.bikes === null && item.status === 'unknown')).toBe(true);
  });
});

describe('findLowestUpcoming', () => {
  /** 대표 시점(5·10·15분)에 원하는 대수를 심은 1분 단위 응답 */
  function withBikesAt(bikesByMinute: Record<number, number>): StationForecastPoint[] {
    return Array.from({ length: 15 }, (_, index) => ({
      dateTime: new Date(Date.UTC(2026, 8, 21, 0, index + 1)).toISOString(),
      bikeCnt: bikesByMinute[index + 1] ?? 9,
      probOut: 0,
    }));
  }

  it('현재를 빼고 가장 적은 시점을 고른다', () => {
    const timeline = toForecastTimeline(withBikesAt({ 5: 4, 10: 1.2, 15: 3 }), 0);

    expect(findLowestUpcoming(timeline)).toMatchObject({ label: '10분', bikes: 1.2 });
  });

  it('같은 값이면 먼저 오는 시점을 고른다', () => {
    const timeline = toForecastTimeline(withBikesAt({ 5: 2, 10: 2, 15: 5 }), 8);

    expect(findLowestUpcoming(timeline)).toMatchObject({ label: '5분' });
  });

  it('현재가 가장 적어도 앞으로의 시점 중에서 고른다', () => {
    const timeline = toForecastTimeline(withBikesAt({ 5: 3, 10: 4, 15: 5 }), 0);

    expect(findLowestUpcoming(timeline)).toMatchObject({ label: '5분', bikes: 3 });
  });

  it('앞으로의 값이 모두 없으면 null', () => {
    expect(findLowestUpcoming(toForecastTimeline([], 5))).toBeNull();
  });
});

describe('describeLowestUpcoming (#154)', () => {
  function withBikesAt(bikesByMinute: Record<number, number>): StationForecastPoint[] {
    return Array.from({ length: 15 }, (_, index) => ({
      dateTime: new Date(Date.UTC(2026, 8, 21, 0, index + 1)).toISOString(),
      bikeCnt: bikesByMinute[index + 1] ?? 9,
      probOut: 0,
    }));
  }

  it('현재보다 1대 이상 줄면 가장 적은 시점을 짚는다', () => {
    const timeline = toForecastTimeline(withBikesAt({ 5: 8, 10: 6, 15: 7 }), 9);

    expect(describeLowestUpcoming(timeline)).toMatchObject({
      kind: 'drop',
      item: { label: '10분', bikes: 6 },
    });
  });

  it('1대 미만으로만 줄거나 늘어나면 크게 줄지 않는다고 알린다', () => {
    // 화면 사례: 현재 11.0 → 11.06 · 11.09 · 11.14 (계속 늘어남)
    expect(
      describeLowestUpcoming(
        toForecastTimeline(withBikesAt({ 5: 11.06, 10: 11.09, 15: 11.14 }), 11),
      ),
    ).toEqual({ kind: 'steady' });
    expect(
      describeLowestUpcoming(toForecastTimeline(withBikesAt({ 5: 8.2, 10: 8.5, 15: 8.4 }), 9)),
    ).toEqual({ kind: 'steady' });
  });

  it('정확히 1대 줄면 짚는다', () => {
    const timeline = toForecastTimeline(withBikesAt({ 5: 9, 10: 8, 15: 9 }), 9);

    expect(describeLowestUpcoming(timeline)).toMatchObject({
      kind: 'drop',
      item: { label: '10분' },
    });
  });

  it('현재 대수를 모르거나 앞으로의 값이 없으면 null(안내 숨김)', () => {
    expect(describeLowestUpcoming(toForecastTimeline(withBikesAt({ 5: 1 }), null))).toBeNull();
    expect(describeLowestUpcoming(toForecastTimeline([], 5))).toBeNull();
  });
});
