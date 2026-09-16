import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * 원래 `features/map/hooks/useToast.ts`였고 관리자 화면(#54)도 쓰게 되어 `shared/`로 올렸다.
 * 로직은 그대로다. 토스트 '모양'은 화면마다 달라서 map/components/Toast(모바일)와
 * admin/ui/AdminToast(관리자)가 따로 있고, 이 훅은 띄우고 지우는 타이밍만 맡는다.
 */

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
