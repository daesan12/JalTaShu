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
  plugins: {
    // 실서버 연결 빌드에서만 켠다: 앱 오리진(https://localhost)이 백엔드 CORS에 막혀서
    // fetch/XHR을 네이티브 HTTP로 우회해야 한다 (쿠키도 네이티브 처리).
    // ⚠ msw 빌드에서는 반드시 꺼야 한다 — 켜면 요청이 서비스 워커를 거치지 않아 msw가 무력화된다.
    CapacitorHttp: { enabled: true },
  },
};

export default config;
