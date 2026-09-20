import {
  DefaultWebViewOptions,
  InAppBrowser,
  type WebViewOptions,
} from '@capacitor/inappbrowser';

/**
 * 카카오 OAuth를 앱 안 WebView 오버레이로 진행한다.
 *
 * 외부 브라우저로 나가면 refresh 쿠키가 브라우저에만 발급돼 앱은 계속 비로그인이다.
 * 인앱 WebView는 앱과 쿠키 저장소를 공유하므로 백엔드 콜백이 심는 쿠키가 앱 것이 되고,
 * 이후 세션 확인(useAuth → 401 → 재발급)이 그 쿠키로 로그인을 복구한다.
 */

const OVERLAY_OPTIONS: WebViewOptions = {
  ...DefaultWebViewOptions,
  showURL: false,
  showNavigationButtons: false,
  closeButtonText: '닫기',
  // 기본값이 열기 전에 쿠키 캐시를 비운다 — 세션 쿠키가 지워지면 안 된다
  clearCache: false,
  clearSessionCache: false,
  android: {
    ...DefaultWebViewOptions.android,
    // 기본값(별도 프로세스 격리)이면 앱과 쿠키 저장소가 분리돼 로그인이 앱에 남지 않는다
    isIsolated: false,
  },
};

/**
 * OAuth가 아직 진행 중인 주소인지 — 카카오 화면이거나 백엔드 OAuth 경로면 계속.
 * 둘 다 아니면 성공/실패 URL(프론트 웹)에 도착한 것이므로 창을 닫을 시점이다.
 * (성공/실패 URL은 백엔드 env로 주입돼 프론트가 값을 모른다 — 소거법으로 판정)
 */
function isOAuthInProgress(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return hostname.endsWith('kakao.com') || pathname.includes('/oauth');
  } catch {
    return true; // 해석할 수 없는 주소는 계속 지켜본다
  }
}

/**
 * @returns 'completed' = 리다이렉트가 끝까지 진행돼 창을 닫음 (세션 확인은 호출한 쪽 몫 —
 *          실패 URL로 끝났어도 재발급이 401이라 비로그인으로 정리된다),
 *          'cancelled' = 사용자가 창을 직접 닫음
 */
export async function openKakaoLoginOverlay(
  oauthUrl: string,
): Promise<'completed' | 'cancelled'> {
  let settle!: (result: 'completed' | 'cancelled') => void;
  const finished = new Promise<'completed' | 'cancelled'>((resolve) => {
    settle = resolve; // Promise는 한 번만 resolve되므로 이후 호출은 무시된다
  });

  const navHandle = await InAppBrowser.addListener(
    'browserPageNavigationCompleted',
    ({ url }) => {
      if (url && !isOAuthInProgress(url)) {
        settle('completed');
        void InAppBrowser.close();
      }
    },
  );
  const closeHandle = await InAppBrowser.addListener('browserClosed', () => {
    settle('cancelled');
  });

  try {
    await InAppBrowser.openInWebView({ url: oauthUrl, options: OVERLAY_OPTIONS });
    return await finished;
  } finally {
    void navHandle.remove();
    void closeHandle.remove();
  }
}
