import { describe, expect, it } from 'vitest';
import { hourlyDatetimes, sumHours } from '@/features/admin/api/adminStationUsage';

describe('hourlyDatetimes — 히트맵 24번으로 하루를 덮는다', () => {
  it('01:00부터 다음 날 00:00까지 24개 (각각 직전 1시간을 집계)', () => {
    const times = hourlyDatetimes('2026-09-22');
    expect(times).toHaveLength(24);
    expect(times[0]).toBe('2026-09-22T01:00:00');
    expect(times[22]).toBe('2026-09-22T23:00:00');
    expect(times[23]).toBe('2026-09-23T00:00:00');
  });

  it('월말이면 마지막 시각이 다음 달 1일로 넘어간다', () => {
    expect(hourlyDatetimes('2026-09-30')[23]).toBe('2026-10-01T00:00:00');
  });
});

describe('sumHours — 고른 시간대만 더한다 (#159)', () => {
  const values = Array.from({ length: 24 }, (_, hour) => hour);

  it('출근 7~9시만 더한다', () => {
    expect(sumHours(values, [7, 8, 9])).toBe(24);
  });

  it('자정을 넘기는 밤 시간대(22, 23, 0, 1시)도 더한다', () => {
    expect(sumHours(values, [22, 23, 0, 1])).toBe(46);
  });
});
