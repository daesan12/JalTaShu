import { useEffect } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';

/**
 * 안내 중 화면이 꺼지지 않게 한다 (2026-09-21 결정, A안).
 *
 * 자전거 주행의 실제 모습은 폰을 거치대에 올려 두는 것인데, 안드로이드는 몇십 초 뒤 화면을 끄고
 * 그러면 WebView가 멈춰 안내도 음성도 같이 멎는다. 안내 중에만 이걸 막는다.
 *
 * **주머니에 넣는 경우는 이걸로 해결되지 않는다** — 사용자가 전원 버튼을 직접 누르면 꺼진다.
 * 그건 포그라운드 서비스가 필요해 별도 이슈(백그라운드 안내 유지)로 뺐다. 두 이슈는 배타적이지
 * 않다. 거치대 사용자는 그 이슈가 끝나도 화면이 켜져 있길 원한다.
 *
 * 웹에서는 Wake Lock API가 쓰이는데 탭이 화면에 없으면 거부한다("The requesting page is not
 * visible"). 개발 중에만 해당하는 일이라 조용히 넘어간다 — 안내 자체는 그대로 돈다.
 */
export function useKeepAwake(active: boolean) {
  useEffect(() => {
    if (!active) return;
    // 요청은 비동기라 **정리가 먼저 끝날 수 있다.** 그때 `allowSleep()`을 먼저 부르고 뒤늦게
    // `keepAwake()`가 성공하면 화면이 영영 안 꺼진다. 늦게 온 성공은 버린다
    let cancelled = false;

    void KeepAwake.keepAwake()
      .then(() => {
        if (cancelled) void KeepAwake.allowSleep().catch(() => {});
      })
      .catch(() => {
        // 지원하지 않는 환경(브라우저 탭이 안 보일 때 등)이면 그냥 넘어간다
      });

    return () => {
      cancelled = true;
      void KeepAwake.allowSleep().catch(() => {});
    };
  }, [active]);
}
