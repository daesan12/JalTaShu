import { useEffect, useRef } from 'react';
import { registerBackHandler } from '@/shared/lib/backHandlers';

/**
 * `active`인 동안 안드로이드 뒤로가기가 `onBack`을 부르게 한다(앱 종료 대신).
 * state로만 여닫는 시트에 쓴다 — URL로 여는 시트는 히스토리가 알아서 닫으니 필요 없다.
 *
 * `onBack`은 렌더마다 새로 만들어져도 된다 — ref로 최신 것을 읽어 재등록하지 않는다.
 * 재등록하면 등록 순서(= 닫히는 순서)가 렌더 타이밍에 따라 바뀐다.
 */
export function useBackHandler(active: boolean, onBack: () => void): void {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });

  useEffect(() => {
    if (!active) return;
    return registerBackHandler(() => onBackRef.current());
  }, [active]);
}
