import { describe, expect, it } from 'vitest';
import { clampDragDelta, getSnapHeights, resolveSnapAfterDrag } from '@/shared/ui/bottomSheetSnap';

const VH = 812; // Figma 기준 뷰포트

describe('getSnapHeights', () => {
  it('큰 화면에서는 고정 px, 작은 화면에서는 비율로 캡된다', () => {
    expect(getSnapHeights(812)).toEqual({ peek: 110, mini: 200, half: 479.08, tall: 624 });
    const small = getSnapHeights(600);
    expect(small.half).toBeCloseTo(354);
    expect(small.tall).toBeCloseTo(462);
  });
});

describe('resolveSnapAfterDrag', () => {
  it('조금만 움직이면 제자리로 돌아온다', () => {
    expect(resolveSnapAfterDrag('half', 20, VH)).toBe('half');
    expect(resolveSnapAfterDrag('half', -20, VH)).toBe('half');
  });

  it('충분히 올리면 위 스냅으로, 내리면 아래 스냅으로 간다', () => {
    expect(resolveSnapAfterDrag('half', -100, VH)).toBe('tall'); // 479→579, tall(624)에 근접
    expect(resolveSnapAfterDrag('half', 200, VH)).toBe('mini'); // 479→279, mini(200)에 근접
  });

  it('한 번의 드래그로 여러 단계를 건너뛸 수 있다', () => {
    expect(resolveSnapAfterDrag('tall', 450, VH)).toBe('mini'); // 624→174
    expect(resolveSnapAfterDrag('peek', -480, VH)).toBe('tall'); // 110→590
  });

  it('peek 높이의 60% 아래로 내리면 닫는다', () => {
    expect(resolveSnapAfterDrag('peek', 50, VH)).toBe('close'); // 110→60 < 66
    expect(resolveSnapAfterDrag('mini', 150, VH)).toBe('close'); // 200→50
  });
});

describe('clampDragDelta', () => {
  it('tall보다 위로는 못 올린다', () => {
    // half(479.08)에서 위로 최대 = tall(624)까지 = -144.92
    expect(clampDragDelta('half', -500, VH, true)).toBeCloseTo(-144.92);
  });

  it('시트 높이보다 아래로는 못 내린다', () => {
    expect(clampDragDelta('mini', 999, VH, true)).toBe(200);
  });

  it('범위 안이면 그대로 통과한다', () => {
    expect(clampDragDelta('half', 80, VH, true)).toBe(80);
  });

  it('고정 높이 시트(canExpand=false)는 위로 끌 수 없다', () => {
    expect(clampDragDelta('mini', -100, VH, false)).toBe(0);
    expect(clampDragDelta('mini', 80, VH, false)).toBe(80); // 아래(닫기)는 가능
  });
});
