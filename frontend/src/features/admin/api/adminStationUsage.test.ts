import { describe, expect, it } from 'vitest';
import { hourlyDatetimes } from '@/features/admin/api/adminStationUsage';

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
