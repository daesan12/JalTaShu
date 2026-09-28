import { describe, expect, it, vi } from 'vitest';
import { registerBackHandler, runBackHandler } from '@/shared/lib/backHandlers';

describe('뒤로가기 등록부', () => {
  it('등록된 게 없으면 false — 브리지가 원래 동작(종료 확인)을 한다', () => {
    expect(runBackHandler()).toBe(false);
  });

  it('가장 최근에 등록한 것 하나만 부른다 — 위에 겹친 시트가 먼저 닫힌다', () => {
    const below = vi.fn();
    const above = vi.fn();
    const removeBelow = registerBackHandler(below);
    const removeAbove = registerBackHandler(above);

    expect(runBackHandler()).toBe(true);
    expect(above).toHaveBeenCalledTimes(1);
    expect(below).not.toHaveBeenCalled();

    removeAbove();
    expect(runBackHandler()).toBe(true);
    expect(below).toHaveBeenCalledTimes(1);

    removeBelow();
    expect(runBackHandler()).toBe(false);
  });

  it('해제는 자기 것만 지운다', () => {
    const a = vi.fn();
    const b = vi.fn();
    const removeA = registerBackHandler(a);
    registerBackHandler(b);
    removeA();
    removeA(); // 두 번 불러도 남의 것을 지우지 않는다
    expect(runBackHandler()).toBe(true);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
