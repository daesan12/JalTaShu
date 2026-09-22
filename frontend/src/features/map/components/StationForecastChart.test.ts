import { describe, expect, it } from 'vitest';
import type { StationForecastPoint } from '@/shared/api/types';
import { toForecastTimeline } from '@/features/map/lib/stationForecastTimeline';

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

  it('현재값과 예측값이 모두 없으면 네 시점을 정보 없음으로 둔다', () => {
    const timeline = toForecastTimeline([], null);

    expect(timeline).toHaveLength(4);
    expect(timeline.every((item) => item.bikes === null && item.status === 'unknown')).toBe(true);
  });
});
