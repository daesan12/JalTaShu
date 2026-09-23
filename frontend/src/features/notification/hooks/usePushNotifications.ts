import { useEffect } from 'react';
import type { PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { registerPushToken } from '@/features/notification/api/pushNotifications';
import {
  deactivateStoredPushToken,
  getOrCreatePushDeviceId,
  isNativePushSupported,
  savePushToken,
} from '@/features/notification/lib/pushNotifications';

export function usePushNotifications(enabled: boolean): void {
  useEffect(() => {
    if (!isNativePushSupported()) return;

    if (!enabled) {
      void deactivateStoredPushToken();
      return;
    }

    let cancelled = false;
    const listeners: Promise<PluginListenerHandle[]> = Promise.all([
      PushNotifications.addListener('registration', ({ value }) => {
        if (cancelled) return;
        savePushToken(value);
        void registerPushToken(value, getOrCreatePushDeviceId()).catch((error) => {
          console.error('FCM 토큰을 서버에 등록하지 못했습니다.', error);
        });
      }),
      PushNotifications.addListener('registrationError', ({ error }) => {
        console.error('FCM 토큰 발급에 실패했습니다.', error);
      }),
    ]);

    const setup = async () => {
      await listeners;
      if (cancelled) return;

      let permission = await PushNotifications.checkPermissions();
      if (
        permission.receive === 'prompt' ||
        permission.receive === 'prompt-with-rationale'
      ) {
        permission = await PushNotifications.requestPermissions();
      }
      if (!cancelled && permission.receive === 'granted') {
        await PushNotifications.register();
      }
    };

    void setup().catch((error) => {
      console.error('푸시 알림 초기화에 실패했습니다.', error);
    });

    return () => {
      cancelled = true;
      void listeners.then((handles) => {
        handles.forEach((listener) => void listener.remove());
      });
    };
  }, [enabled]);
}
