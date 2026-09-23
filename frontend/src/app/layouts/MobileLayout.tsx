import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { usePushNotifications } from '@/features/notification/hooks/usePushNotifications';
import {
  loadSettings,
  SETTINGS_CHANGED_EVENT,
  type AppSettings,
} from '@/features/mypage/lib/settingsStorage';
import { TabBar } from '@/shared/ui/TabBar';

/**
 * 모바일 전용 레이아웃: 최대 폭 430px 중앙 정렬 + 하단 탭바.
 * 관리자(/admin) 라우트는 이 레이아웃을 쓰지 않는다.
 */
export function MobileLayout() {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    const handleSettingsChanged = (event: Event) => {
      setSettings((event as CustomEvent<AppSettings>).detail);
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChanged);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChanged);
  }, []);

  usePushNotifications(settings.pushEnabled);

  return (
    <div className="relative mx-auto flex h-dvh max-w-[430px] flex-col bg-surface shadow-lg">
      <main className="flex-1 overflow-y-auto overscroll-contain">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
