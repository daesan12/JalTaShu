import { useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

/**
 * 음성 안내(TTS) — 네이티브 플러그인(`@capacitor-community/text-to-speech`)을 쓴다.
 * 이 플러그인은 웹에서 `speechSynthesis`로 떨어지므로 브라우저 개발 중에도 그대로 들린다.
 *
 * **웹 `speechSynthesis`를 직접 쓰지 않는 이유**(2026-09-21 교체):
 * - 안드로이드 WebView의 `speechSynthesis`는 기기마다 한국어 음성이 없거나 볼륨 채널이 어긋난다
 * - 무엇보다 **화면이 꺼지면 죽는다.** 네이티브 TTS는 화면이 꺼져도 말한다 —
 *   주머니 주행(백그라운드 안내) 이슈가 성립하려면 이 교체가 먼저다
 *
 * 함정 둘(웹에서만 해당하지만 코드는 그대로 둔다):
 * - 사용자가 아무것도 누르지 않은 상태의 첫 발화는 브라우저가 막는다. 그래서 "안내 시작"을
 *   누르는 그 순간 `prime()`으로 소리 없는 발화를 한 번 해서 권한을 받아 둔다.
 * - 한국어 음성이 없는 기기가 있다(데스크톱 크롬). 그때는 조용히 넘어간다 — 안내 자체는 화면에 있다.
 */

/** 플러그인이 실패해도 앱은 그대로 동작한다 — 음성은 화면 안내의 보조다 */
function ignore() {
  // 의도적으로 비워 둔다
}

export function useSpeech(enabled: boolean) {
  const primedRef = useRef(false);

  const supported =
    Capacitor.isNativePlatform() || (typeof window !== 'undefined' && 'speechSynthesis' in window);

  /** 사용자 제스처(버튼 누름) 안에서 호출해야 의미가 있다 */
  const prime = useCallback(() => {
    if (!supported || primedRef.current) return;
    primedRef.current = true;
    TextToSpeech.speak({ text: ' ', lang: 'ko-KR', volume: 0 }).catch(ignore);
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !enabled || text.length === 0) return;
      // 앞 안내가 남아 있으면 끊는다 — 지난 회전을 읽는 중에 다음 회전이 와도 최신 것이 먼저다.
      // 플러그인 기본값(QueueStrategy.Flush)이 이미 그렇게 동작한다
      TextToSpeech.speak({ text, lang: 'ko-KR', rate: 1.05 }).catch(ignore);
    },
    [supported, enabled],
  );

  // 음성을 끄거나 화면을 떠나면 읽던 것을 멈춘다
  useEffect(() => {
    if (enabled || !supported) return;
    TextToSpeech.stop().catch(ignore);
  }, [enabled, supported]);

  useEffect(() => {
    if (!supported) return;
    return () => {
      TextToSpeech.stop().catch(ignore);
    };
  }, [supported]);

  return { supported, prime, speak };
}
