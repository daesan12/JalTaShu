import { describe, expect, it } from 'vitest';
import { buildElevationProfile, classifyGrade } from '@/features/map/lib/routeElevation';
import { makeLeg, makeRoute } from '@/features/map/lib/__fixtures__/route';

/**
 * 위도 36.35에서 경도 0.001도 ≈ 89.6m. 좌표를 경도로만 벌려 거리를 만든다.
 * 실응답은 고도가 **좌표마다** 붙어 오므로, 좌표 하나에 고도 하나를 준다.
 */
function routeWithAltitudes(altitudes: number[]) {
  return makeRoute({
    legs: [makeLeg('BICYCLE', 0, altitudes.length - 1, 1000, 300, altitudes)],
  });
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
  it('좌표가 2개 미만이면 빈 결과', () => {
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
    // 좌표 간 89.6m마다 9m씩 오름 → 약 10%
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

  it('구간이 여러 개여도 경로 전체를 하나로 이어 본다 — 경계 좌표를 두 번 세지 않는다', () => {
    // 기본 경로(좌표 11개, 구간 3개)가 평지면 전 구간이 flat이어야 한다
    const profile = buildElevationProfile(makeRoute());
    expect(profile.bars).toHaveLength(24);
    expect(profile.maxGradePct).toBe(0);
  });
});
