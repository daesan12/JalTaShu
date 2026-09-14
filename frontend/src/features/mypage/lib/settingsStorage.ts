import { STORAGE_KEYS } from '@/shared/config/constants';

/**
 * 앱 설정 (localStorage) — 현재는 UI 상태 저장만.
 * 실제 동작 연결: 자동 로그인은 세션 정책 확정 후, 푸시 수신은 FCM 연동 시.
 */
export interface AppSettings {
  autoLogin: boolean;
  pushEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = { autoLogin: true, pushEnabled: true };

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    // 파싱 실패 시 기본값
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  } catch {
    // 저장 불가 환경 무시
  }
}
