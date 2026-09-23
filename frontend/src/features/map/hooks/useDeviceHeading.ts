import { useEffect, useState } from 'react';

/** 이만큼 이하로 흔들리는 건 무시한다 — 나침반은 가만히 둬도 1~2도씩 떨린다 */
const MIN_CHANGE_DEG = 3;
/** 갱신 간격(ms). 센서는 초당 수십 번 오는데 화살표가 그만큼 자주 돌 필요는 없다 */
const THROTTLE_MS = 120;

interface AbsoluteOrientationEvent extends DeviceOrientationEvent {
  /** iOS 전용 — 이미 북쪽 기준 시계방향 각도라 변환이 필요 없다 */
  webkitCompassHeading?: number;
}

/**
 * 센서 값 → 방위(0=북, 시계방향). 쓸 수 없는 값이면 null.
 * 순수 함수로 빼 둔다 — 부호 하나만 틀려도 화살표가 반대를 가리키는데 눈으로는 알기 어렵다.
 */
export function toHeading(
  event: Pick<AbsoluteOrientationEvent, 'alpha' | 'absolute' | 'webkitCompassHeading'>,
  screenAngle = 0,
): number | null {
  if (typeof event.webkitCompassHeading === 'number') return event.webkitCompassHeading;
  if (!event.absolute || event.alpha === null || event.alpha === undefined) return null;
  return (360 - event.alpha + screenAngle) % 360;
}

/**
 * 기기가 향한 방향(0=북, 시계방향 度). 값을 얻을 수 없으면 null.
 *
 * 안드로이드는 `deviceorientationabsolute`만 나침반 값을 준다 — 일반 `deviceorientation`은
 * `absolute: false`로 상대 각도라 방위로 쓸 수 없다(실기기 확인).
 * alpha는 북쪽에서 **반시계** 방향이라 뒤집어야 시계방향 방위가 된다.
 */
export function useDeviceHeading(active: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;

    let last = 0;
    let current: number | null = null;

    function onOrientation(event: Event) {
      // 화면이 돌아가 있으면 그만큼 더한다(앱은 세로 고정이라 보통 0이다)
      const next = toHeading(event as AbsoluteOrientationEvent, screen.orientation?.angle ?? 0);
      if (next === null || !Number.isFinite(next)) return;

      const now = Date.now();
      if (now - last < THROTTLE_MS) return;
      // 0도와 359도는 1도 차이다 — 경계를 넘을 때 값이 튀지 않게 짧은 쪽으로 잰다
      if (current !== null && Math.abs(((next - current + 540) % 360) - 180) < MIN_CHANGE_DEG) {
        return;
      }
      last = now;
      current = next;
      setHeading(next);
    }

    window.addEventListener('deviceorientationabsolute', onOrientation);
    return () => {
      window.removeEventListener('deviceorientationabsolute', onOrientation);
    };
  }, [active]);

  // 꺼져 있을 때 null은 렌더에서 결정한다 — 이펙트에서 state를 되돌리면 렌더가 한 번 더 돈다
  return active ? heading : null;
}
