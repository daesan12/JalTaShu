import { useCallback, useEffect, useRef } from 'react';

/**
 * 음성 안내(TTS) — 브라우저 내장 `speechSynthesis`를 쓴다. 서버도 설치도 필요 없다.
 *
 * Capacitor로 감싼 뒤에는 **이 파일만** 네이티브 TTS 플러그인으로 바꾼다
 * (현재위치를 `useCurrentLocation.ts` 하나만 갈아끼우게 만든 것과 같은 구조).
 *
 * 함정 둘:
 * - 사용자가 아무것도 누르지 않은 상태의 첫 발화는 브라우저가 막는다. 그래서 "안내 시작"을
 *   누르는 그 순간 `prime()`으로 소리 없는 발화를 한 번 해서 권한을 받아 둔다.
 * - 한국어 음성이 없는 기기가 있다(데스크톱 크롬). 그때는 조용히 넘어간다 — 안내 자체는 화면에 있다.
 */
export function useSpeech(enabled: boolean) {
  const primedRef = useRef(false);

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  /** 사용자 제스처(버튼 누름) 안에서 호출해야 의미가 있다 */
  const prime = useCallback(() => {
    if (!supported || primedRef.current) return;
    try {
      const warmUp = new SpeechSynthesisUtterance(' ');
      warmUp.volume = 0;
      warmUp.lang = 'ko-KR';
      window.speechSynthesis.speak(warmUp);
      primedRef.current = true;
    } catch {
      // 음성을 못 써도 앱은 그대로 동작한다
    }
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !enabled || text.length === 0) return;
      try {
        // 앞 안내가 남아 있으면 끊는다 — 지난 회전을 읽는 중에 다음 회전이 와도 최신 것이 먼저다
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      } catch {
        // 위와 같다
      }
    },
    [supported, enabled],
  );

  // 음성을 끄거나 화면을 떠나면 읽던 것을 멈춘다
  useEffect(() => {
    if (enabled || !supported) return;
    window.speechSynthesis.cancel();
  }, [enabled, supported]);

  useEffect(() => {
    if (!supported) return;
    return () => window.speechSynthesis.cancel();
  }, [supported]);

  return { supported, prime, speak };
}
