import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatDistance, formatMinutes, formatTimeAgo } from '@/shared/lib/format';

describe('formatDistance', () => {
  it('1km 미만은 m로 반올림 표시', () => {
    expect(formatDistance(350)).toBe('350m');
    expect(formatDistance(999.4)).toBe('999m');
  });

  it('1km 이상은 소수 첫째 자리 km', () => {
    expect(formatDistance(1000)).toBe('1.0km');
    expect(formatDistance(1234)).toBe('1.2km');
  });
});

describe('formatMinutes', () => {
  it('60분 미만은 분', () => {
    expect(formatMinutes(5)).toBe('5분');
    expect(formatMinutes(59.4)).toBe('59분'); // 반올림
  });

  it('반올림해서 60분이 되면 1시간으로 승격된다', () => {
    expect(formatMinutes(59.6)).toBe('1시간');
  });

  it('정각 시간은 시간만', () => {
    expect(formatMinutes(60)).toBe('1시간');
    expect(formatMinutes(120)).toBe('2시간');
  });

  it('시간+분 조합', () => {
    expect(formatMinutes(84)).toBe('1시간 24분');
  });
});

describe('formatDate', () => {
  it('ISO → YYYY.MM.DD (0 채움)', () => {
    expect(formatDate('2026-08-28T10:00:00+09:00')).toBe('2026.08.28');
    expect(formatDate('2026-01-05T00:00:00+09:00')).toBe('2026.01.05');
  });
});

describe('formatTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00+09:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const at = (iso: string) => formatTimeAgo(iso);

  it('초·분·시간·일·주 단위로 표시한다', () => {
    expect(at('2026-09-10T11:59:50+09:00')).toBe('10초 전');
    expect(at('2026-09-10T11:57:00+09:00')).toBe('3분 전');
    expect(at('2026-09-10T07:00:00+09:00')).toBe('5시간 전');
    expect(at('2026-09-07T12:00:00+09:00')).toBe('3일 전');
    expect(at('2026-08-27T12:00:00+09:00')).toBe('2주 전');
  });

  it('미래 시각(시계 오차)은 0초 전으로 방어한다', () => {
    expect(at('2026-09-10T12:00:05+09:00')).toBe('0초 전');
  });
});
