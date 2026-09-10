/**
 * BottomSheet 스냅 계산 — 순수 함수로 분리해 유닛 테스트 가능하게 유지.
 * 높이 값은 BottomSheet.tsx의 Tailwind 클래스(h-[110px] · h-[59dvh] max-h-[480px] 등)와
 * 반드시 일치해야 한다.
 */
export type SnapPoint = 'peek' | 'mini' | 'half' | 'tall';

export const SNAP_ORDER: SnapPoint[] = ['peek', 'mini', 'half', 'tall'];

/** Figma 812px 기준 높이: peek 110 / mini 200 / half 480 / tall 624 (작은 화면은 비율 캡) */
export function getSnapHeights(viewportHeight: number): Record<SnapPoint, number> {
  return {
    peek: 110,
    mini: 200,
    half: Math.min(480, viewportHeight * 0.59),
    tall: Math.min(624, viewportHeight * 0.77),
  };
}

/**
 * 드래그가 끝났을 때 어디로 스냅할지 결정.
 * @param deltaY 손가락 이동량(px, 아래로 양수)
 * @returns 'close'(peek보다 한참 아래로 내림) 또는 가장 가까운 스냅
 */
export function resolveSnapAfterDrag(
  current: SnapPoint,
  deltaY: number,
  viewportHeight: number,
): SnapPoint | 'close' {
  const heights = getSnapHeights(viewportHeight);
  const targetHeight = heights[current] - deltaY;

  // peek 높이의 60% 아래까지 내리면 닫기 의도로 판단
  if (targetHeight < heights.peek * 0.6) return 'close';

  let best: SnapPoint = 'peek';
  let bestDiff = Infinity;
  for (const snap of SNAP_ORDER) {
    const diff = Math.abs(heights[snap] - targetHeight);
    if (diff < bestDiff) {
      best = snap;
      bestDiff = diff;
    }
  }
  return best;
}

/** 드래그 중 이동량 제한: tall 위로는 못 올리고, 바닥 아래로는 시트 높이만큼만 */
export function clampDragDelta(
  current: SnapPoint,
  deltaY: number,
  viewportHeight: number,
): number {
  const heights = getSnapHeights(viewportHeight);
  const min = -(heights.tall - heights[current]); // 위로 최대 (tall까지)
  const max = heights[current]; // 아래로 최대 (완전히 사라질 때까지)
  return Math.min(max, Math.max(min, deltaY));
}
