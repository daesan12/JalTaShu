import { Outlet } from 'react-router';

/** 탭바 없는 모바일 레이아웃 — 온보딩·로그인·가입 등 진입 플로우용 */
export function BareLayout() {
  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col bg-surface shadow-lg">
      <Outlet />
    </div>
  );
}
