import { Outlet } from 'react-router';
import { TabBar } from '@/shared/ui/TabBar';

/**
 * 모바일 전용 레이아웃: 최대 폭 430px 중앙 정렬 + 하단 탭바.
 * 관리자(/admin) 라우트는 이 레이아웃을 쓰지 않는다.
 */
export function MobileLayout() {
  return (
    <div className="relative mx-auto flex h-dvh max-w-[430px] flex-col bg-surface shadow-lg">
      <main className="flex-1 overflow-y-auto overscroll-contain">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
