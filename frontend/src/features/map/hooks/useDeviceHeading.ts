import { useEffect, useState } from 'react';

/** 이만큼 이하로 흔들리는 건 무시한다 — 나침반은 가만히 둬도 1~2도씩 떨린다 */
const MIN_CHANGE_DEG = 3;
/** 갱신 간격(ms). 센서는 초당 수십 번 오는데 화살표가 그만큼 자주 돌 필요는 없다 */
const THROTTLE_MS = 120;

interface AbsoluteOrientationEvent extends DeviceOrientationEvent {
  /** iOS 전용 — 이미 북쪽 기준 시계방향 각도라 변환이 필요 없다 */
  webkitCompassHeading?: number;
}

type OrientationInput = Pick<AbsoluteOrientationEvent, 'alpha' | 'absolute' | 'webkitCompassHeading'> &
  Partial<Pick<AbsoluteOrientationEvent, 'beta' | 'gamma'>>;

const DEG = Math.PI / 180;

/**
 * 센서 값 → 방위(0=북, 시계방향). 쓸 수 없는 값이면 null.
 *
 * alpha만 쓰면 **폰을 눕혔을 때만** 맞는다. 세워 들면(안내 중 보통 자세) alpha·gamma가 같은 축을 돌려
 * 값이 서로 섞이고, 90도에 가까울수록 alpha 하나로는 방향을 알 수 없다(짐벌 락).
 * 그래서 세 각으로 회전 행렬(Z-X'-Y'', W3C 규격)을 만들고, 폰의 한 축을 지면에 투영해 방위를 잰다.
 *
 * - 눕힌 폰: **윗변**(y축)이 가리키는 쪽이 내가 보는 방향
 * - 세운 폰: **뒷면**(−z축, 카메라 방향)이 가리키는 쪽이 내가 보는 방향
 * 두 축 중 지면에 더 길게 드리운 쪽을 쓴다. 순수하게 앞뒤로만 기울인 폰은 두 축이 같은 방위를 가리켜
 * 자세를 바꿔도 화살표가 튀지 않는다.
 *
 * 순수 함수로 빼 둔다 — 부호 하나만 틀려도 화살표가 반대를 가리키는데 눈으로는 알기 어렵다.
 */
export function toHeading(event: OrientationInput, screenAngle = 0): number | null {
  if (typeof event.webkitCompassHeading === 'number') return event.webkitCompassHeading;
  if (!event.absolute || event.alpha === null || event.alpha === undefined) return null;

  const a = event.alpha * DEG;
  // 세로 고정 앱이라도 값이 안 올 수 있다 — 없으면 눕힌 것으로 본다(기존 alpha 뒤집기와 같아진다)
  const b = (event.beta ?? 0) * DEG;
  const g = (event.gamma ?? 0) * DEG;
  const cA = Math.cos(a);
  const sA = Math.sin(a);
  const cB = Math.cos(b);
  const sB = Math.sin(b);
  const cG = Math.cos(g);
  const sG = Math.sin(g);

  // 회전 행렬 열 = 폰 축을 지구 좌표(동, 북, 위)로 옮긴 것. 그중 동·북 성분만 쓴다.
  // 윗변(y축)
  const topEast = -sA * cB;
  const topNorth = cA * cB;
  // 뒷면(−z축)
  const backEast = -cA * sG - sA * sB * cG;
  const backNorth = -sA * sG + cA * sB * cG;

  // 지면에 더 길게 드리운 축이 방향을 더 믿을 만하게 알려준다
  const useBack = backEast ** 2 + backNorth ** 2 > topEast ** 2 + topNorth ** 2;
  const east = useBack ? backEast : topEast;
  const north = useBack ? backNorth : topNorth;
  if (east === 0 && north === 0) return null;

  const heading = Math.atan2(east, north) / DEG;
  // 화면이 돌아가 있으면 그만큼 더한다(앱은 세로 고정이라 보통 0이다)
  return (((heading + screenAngle) % 360) + 360) % 360;
}

/**
 * 기기가 향한 방향(0=북, 시계방향 度). 값을 얻을 수 없으면 null.
 *
 * 안드로이드는 `deviceorientationabsolute`만 나침반 값을 준다 — 일반 `deviceorientation`은
 * `absolute: false`로 상대 각도라 방위로 쓸 수 없다(실기기 확인). 변환은 `toHeading` 참고.
 */
export function useDeviceHeading(active: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;

    let last = 0;
    let current: number | null = null;

    function onOrientation(event: Event) {
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
