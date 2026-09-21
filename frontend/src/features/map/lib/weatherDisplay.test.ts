import { describe, expect, it } from 'vitest';
import {
  formatRainfall,
  formatTemperature,
  isStale,
  toRainLevel,
  toRidingHint,
} from '@/features/map/lib/weatherDisplay';

describe('비 세기 판정', () => {
  it('강수량 0은 비 없음', () => {
    expect(toRainLevel(0)).toBe('none');
  });

  it('1mm를 경계로 약한 비와 비가 갈린다', () => {
    expect(toRainLevel(0.9)).toBe('light');
    expect(toRainLevel(1)).toBe('moderate');
  });

  it('5mm 이상은 강한 비', () => {
    expect(toRainLevel(4.9)).toBe('moderate');
    expect(toRainLevel(5)).toBe('heavy');
  });

  it('이상값(NaN·음수)은 비 없음으로 떨어진다', () => {
    expect(toRainLevel(Number.NaN)).toBe('none');
    expect(toRainLevel(-1)).toBe('none');
  });

  it('비가 안 오면 안내 문구를 만들지 않는다', () => {
    expect(toRidingHint('none')).toBeNull();
    expect(toRidingHint('heavy')).not.toBeNull();
  });
});

describe('표시 형식', () => {
  it('기온은 정수로 반올림한다', () => {
    expect(formatTemperature(17.4)).toBe('17°');
    expect(formatTemperature(-3.6)).toBe('-4°');
  });

  it('강수량은 소수 한 자리, 이상값은 0으로', () => {
    expect(formatRainfall(0)).toBe('0.0mm');
    expect(formatRainfall(1.25)).toBe('1.3mm');
    expect(formatRainfall(Number.NaN)).toBe('0.0mm');
  });
});

describe('오래된 관측 판정', () => {
  const now = new Date('2026-09-21T12:00:00+09:00').getTime();

  it('2시간 이내면 최신으로 본다', () => {
    expect(isStale('2026-09-21T11:00:00+09:00', now)).toBe(false);
  });

  it('2시간을 넘으면 오래된 값', () => {
    expect(isStale('2026-09-21T09:30:00+09:00', now)).toBe(true);
  });

  it('시각을 못 읽으면 신뢰하지 않는다', () => {
    expect(isStale('없는 시각', now)).toBe(true);
  });
});
