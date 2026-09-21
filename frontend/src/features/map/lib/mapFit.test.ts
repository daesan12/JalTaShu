import { describe, expect, it } from 'vitest';
import { isPathFitted } from '@/features/map/lib/mapFit';

/** 10 비교 화면 크기 정도 */
const SIZE = { width: 390, height: 780 };

describe('isPathFitted', () => {
  it('경로가 화면 안에 있으면 fitBounds가 반영된 것이다', () => {
    expect(isPathFitted({ top: 100, bottom: 400, left: 40, right: 350 }, SIZE)).toBe(true);
  });

  it('시트에 가려도 "반영됐다"로 본다 — 그건 보정할 일이지 다시 맞출 일이 아니다', () => {
    // 시트가 화면의 59%를 덮어 아래쪽이 시트 뒤에 있지만, 화면 안이긴 하다
    expect(isPathFitted({ top: 100, bottom: 760, left: 40, right: 350 }, SIZE)).toBe(true);
  });

  it('경로가 화면 밖으로 나가 있으면 우리 fitBounds가 아니다 — 목적지 morph가 덮어쓴 상태', () => {
    // 목적지 확대(z16)에서 재면 경로가 화면의 몇 배가 된다
    expect(isPathFitted({ top: -1200, bottom: 2400, left: -800, right: 1500 }, SIZE)).toBe(false);
  });

  it('한쪽만 삐져나가도 아니다', () => {
    expect(isPathFitted({ top: -60, bottom: 400, left: 40, right: 350 }, SIZE)).toBe(false);
    expect(isPathFitted({ top: 100, bottom: 900, left: 40, right: 350 }, SIZE)).toBe(false);
    expect(isPathFitted({ top: 100, bottom: 400, left: -50, right: 350 }, SIZE)).toBe(false);
    expect(isPathFitted({ top: 100, bottom: 400, left: 40, right: 500 }, SIZE)).toBe(false);
  });

  it('경계에 딱 붙은 것은 반영된 것이다 — 반올림 차이로 무한히 다시 맞추면 안 된다', () => {
    expect(isPathFitted({ top: 0, bottom: 780, left: 0, right: 390 }, SIZE)).toBe(true);
    expect(isPathFitted({ top: -2, bottom: 782, left: -2, right: 392 }, SIZE)).toBe(true);
    expect(isPathFitted({ top: -3, bottom: 400, left: 40, right: 350 }, SIZE)).toBe(false);
  });

  it('점 하나짜리 경로도 화면 안이면 반영된 것이다', () => {
    expect(isPathFitted({ top: 300, bottom: 300, left: 200, right: 200 }, SIZE)).toBe(true);
  });
});
