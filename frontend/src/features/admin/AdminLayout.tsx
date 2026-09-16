import { Outlet } from 'react-router';
import { AdminSidebar } from '@/features/admin/ui/AdminSidebar';

/**
 * 관리자 웹 레이아웃 — 모바일 430px 제약을 적용하지 않는 데스크톱 레이아웃.
 * Figma 기준 사이드바 240 + 본문 1200 = 1440. 반응형은 범위 밖이다.
 * 이 파일 이하 전체가 별도 청크로 지연 로딩됨 (모바일 사용자는 다운로드하지 않음).
 * TODO: 관리자 인증 가드 추가 (로그인 API 확정 후)
 */
export function AdminLayout() {
  return (
    <div className="flex min-h-dvh bg-admin-bg text-admin-text">
      <AdminSidebar />
      <main className="min-w-0 flex-1 px-8 py-7">
        <Outlet />
      </main>
    </div>
  );
}
