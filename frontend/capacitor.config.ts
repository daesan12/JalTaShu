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
};

export default config;
