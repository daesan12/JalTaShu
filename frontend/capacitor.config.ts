import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor 설정 — 안드로이드 앱 래핑.
 * ⚠ 앱용 빌드는 base가 '/'여야 한다 (VITE_BASE_PATH 미설정 상태로 npm run build).
 *   staging용 /staging/ base가 들어간 dist를 cap sync하면 WebView에서 흰 화면이 뜬다.
 */
const config: CapacitorConfig = {
  appId: 'com.ssafy.zaltashu',
  appName: '잘타슈',
  webDir: 'dist',
  android: {
    /**
     * 12 안내의 백그라운드 위치 추적(#115) 때문에 켠다.
     * `@capacitor-community/background-geolocation` README가 요구하는 설정으로, 이게 없으면
     * **백그라운드 5분 뒤 위치 업데이트가 멎는다**(플러그인 issue #89).
     *
     * 바뀌는 것은 JS↔네이티브 **브리지 통신 방식뿐**이다(`addWebMessageListener` →
     * `addJavascriptInterface`). 오리진·localStorage·쿠키는 그대로다 — 확인함.
     * 다만 구글이 전자를 "더 안전한 쪽"으로 안내하므로, 백그라운드 안내를 접게 되면 같이 되돌린다.
     */
    useLegacyBridge: true,
  },
  plugins: {
    // 실서버 연결 빌드에서만 켠다: 앱 오리진(https://localhost)이 백엔드 CORS에 막혀서
    // fetch/XHR을 네이티브 HTTP로 우회해야 한다 (쿠키도 네이티브 처리).
    // ⚠ msw 빌드에서는 반드시 꺼야 한다 — 켜면 요청이 서비스 워커를 거치지 않아 msw가 무력화된다.
    //
    // #115 덤: 이게 켜져 있어서 **백그라운드 5분 뒤 재탐색이 막히는 문제가 없다.** 안드로이드가
    // 조이는 것은 WebView에서 나가는 HTTP인데, axios→XHR이 여기서 네이티브로 우회된다
    // (플러그인 README가 지목한 해법이 정확히 이 플러그인이다).
    CapacitorHttp: { enabled: true },
  },
};

export default config;
