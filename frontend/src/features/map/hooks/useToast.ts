import { useCallback, useEffect, useRef, useState } from 'react';

/** 안내 문구가 화면에 머무는 시간 (ms) */
const TOAST_DURATION = 2000;

/**
 * 짧은 안내 문구 하나를 잠시 띄운다.
 * 같은 버튼을 연타해도 안내는 하나만 뜨고, 마지막 누른 시점부터 다시 센다.
 */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const showToast = useCallback((text: string) => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setMessage(text);
    timerRef.current = window.setTimeout(() => {
      setMessage(null);
      timerRef.current = null;
    }, TOAST_DURATION);
  }, []);

  // 화면을 벗어날 때 타이머가 남아 setState가 호출되지 않도록 정리
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return { message, showToast };
}
