import { Capacitor } from '@capacitor/core';
import { deactivatePushToken } from '@/features/notification/api/pushNotifications';
import { STORAGE_KEYS } from '@/shared/config/constants';

export function isNativePushSupported(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export function getOrCreatePushDeviceId(): string {
  const saved = localStorage.getItem(STORAGE_KEYS.pushDeviceId);
  if (saved) return saved;

  const deviceId =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(STORAGE_KEYS.pushDeviceId, deviceId);
  return deviceId;
}

export function savePushToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.pushToken, token);
}

export function getStoredPushToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.pushToken);
}

/** 서버 수신만 끈다. FCM 토큰은 보관해서 설정을 다시 켤 때 재등록할 수 있게 한다. */
export async function deactivateStoredPushToken(): Promise<void> {
  if (!isNativePushSupported()) return;
  const token = getStoredPushToken();
  if (!token) return;

  try {
    await deactivatePushToken(token);
  } catch (error) {
    // 로그아웃과 앱 사용 자체를 푸시 정리 실패로 막지 않는다.
    console.warn('푸시 토큰 비활성화에 실패했습니다.', error);
  }
}
