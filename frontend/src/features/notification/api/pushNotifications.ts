import { apiDelete, apiPost } from '@/shared/api/client';

export function registerPushToken(token: string, deviceId: string): Promise<null> {
  return apiPost<null>('/fcm/tokens', {
    token,
    platform: 'ANDROID',
    deviceId,
  });
}

export function deactivatePushToken(token: string): Promise<null> {
  return apiDelete<null>('/fcm/tokens', { data: { token } });
}
