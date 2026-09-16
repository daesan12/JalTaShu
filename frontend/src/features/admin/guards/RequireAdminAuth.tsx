import { Navigate, Outlet } from 'react-router';
import { useAdminAuth } from '@/features/admin/hooks/useAdminAuth';

/**
 * 관리자 화면 진입 가드. 미로그인이면 관리자 로그인으로 보낸다.
 * 모바일 RequireAuth와 달리 스플래시·온보딩 단계가 없다.
 */
export function RequireAdminAuth() {
  const { isPending, isLoggedIn } = useAdminAuth();

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-admin-bg text-sm text-admin-muted">
        불러오는 중…
      </div>
    );
  }
  if (!isLoggedIn) return <Navigate to="/admin/login" replace />;

  return <Outlet />;
}
