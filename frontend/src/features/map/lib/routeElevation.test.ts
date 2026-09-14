import { describe, expect, it } from 'vitest';
import type { RoutePath } from '@/shared/api/types';
import { buildElevationProfile, classifyGrade } from '@/features/map/lib/routeElevation';

/**
 * 위도 36.35에서 경도 0.001도 ≈ 89.6m. 고도 지점을 경도로만 벌려 거리를 만든다.
 * `altitude[]`는 `location[]`과 길이가 달라도 되므로 여기서는 location을 비워 둔다.
 */
function routeWithAltitudes(altitudes: number[]): RoutePath {
  return {
    distance: [1000],
    time: [300],
    behave: ['BIKE'],
    location: [],
    altitude: altitudes.map((altitude, i) => ({
      xPos: 127 + i * 0.001,
      yPos: 36.35,
      altitude,
    })),
    expectedBikeCnt: 3,
  };
}

describe('classifyGrade', () => {
  it('경사 구간마다 4단계로 나눈다', () => {
    expect(classifyGrade(-5)).toBe('flat');
    expect(classifyGrade(0)).toBe('flat');
    expect(classifyGrade(1.9)).toBe('flat');
    expect(classifyGrade(2)).toBe('gentle');
    expect(classifyGrade(4.9)).toBe('gentle');
    expect(classifyGrade(5)).toBe('climb');
    expect(classifyGrade(7.9)).toBe('climb');
    expect(classifyGrade(8)).toBe('steep');
  });
});

describe('buildElevationProfile', () => {
  it('고도 지점이 2개 미만이면 빈 결과', () => {
    expect(buildElevationProfile(routeWithAltitudes([50]))).toEqual({ bars: [], maxGradePct: 0 });
  });

  it('막대를 24개 만든다', () => {
    const profile = buildElevationProfile(routeWithAltitudes(Array.from({ length: 40 }, () => 50)));
    expect(profile.bars).toHaveLength(24);
  });

  it('평지면 모두 flat이고 최대 경사는 0', () => {
    const profile = buildElevationProfile(routeWithAltitudes(Array.from({ length: 40 }, () => 50)));
    expect(profile.bars.every((bar) => bar.grade === 'flat')).toBe(true);
    expect(profile.maxGradePct).toBe(0);
    // 높이 차이가 없으면 막대가 사라지지 않게 중간 높이로 둔다
    expect(profile.bars.every((bar) => bar.value === 0.5)).toBe(true);
  });

  it('꾸준히 오르면 뒤쪽 막대가 더 높고 경사 등급이 붙는다', () => {
    // 지점 간 89.6m마다 9m씩 오름 → 약 10%
    const climbing = Array.from({ length: 40 }, (_, i) => 50 + i * 9);
    const profile = buildElevationProfile(routeWithAltitudes(climbing));
    expect(profile.bars[0].value).toBeLessThan(profile.bars.at(-1)!.value);
    expect(profile.maxGradePct).toBeGreaterThanOrEqual(9);
    expect(profile.bars.every((bar) => bar.grade === 'steep')).toBe(true);
  });

  it('내리막은 평지·내리막으로 묶고 최대 경사는 오르막만 본다', () => {
    const descending = Array.from({ length: 40 }, (_, i) => 400 - i * 9);
    const profile = buildElevationProfile(routeWithAltitudes(descending));
    expect(profile.bars.every((bar) => bar.grade === 'flat')).toBe(true);
    expect(profile.maxGradePct).toBe(0);
  });

  it('막대 높이는 0~1 안에 있다', () => {
    const hill = Array.from({ length: 40 }, (_, i) => 50 + Math.sin((Math.PI * i) / 39) * 60);
    const profile = buildElevationProfile(routeWithAltitudes(hill));
    expect(profile.bars.every((bar) => bar.value >= 0 && bar.value <= 1)).toBe(true);
  });
});
