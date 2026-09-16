import { useQueryClient } from '@tanstack/react-query';
import { NavLink, useNavigate } from 'react-router';
import { adminLogout } from '@/features/admin/api/adminAuth';
import { ADMIN_ME_QUERY_KEY, useAdminAuth } from '@/features/admin/hooks/useAdminAuth';

/** Figma Admin/Sidebar의 Active 5종과 1:1. 순서도 Figma 그대로다. 아이콘은 없다. */
const MENUS = [
  { to: '/admin', label: '히트맵', end: true },
  { to: '/admin/users', label: '사용자 관리', end: false },
  { to: '/admin/bikes', label: '자전거 관리', end: false },
  { to: '/admin/claims', label: '제보 관리', end: false },
  { to: '/admin/notices', label: '공지사항', end: false },
];

/** 활성 표시는 배경 + 왼쪽 3px 인디케이터 두 가지. 비활성도 같은 폭의 투명 테두리를 둬야 글자가 밀리지 않는다. */
const BASE = 'block border-l-[3px] py-2.5 pr-4 pl-[17px] text-sm transition-colors';
const ACTIVE = 'border-admin-indicator bg-admin-sidebar-active font-medium text-white';
const INACTIVE = 'border-transparent text-admin-sidebar-label hover:text-white';

export function AdminSidebar() {
  const { admin } = useAdminAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await adminLogout();
    } finally {
      // 실패해도 화면은 로그아웃 상태로 보낸다 — 캐시에 남은 관리자 정보를 먼저 지운다
      queryClient.removeQueries({ queryKey: ADMIN_ME_QUERY_KEY });
      navigate('/admin/login', { replace: true });
    }
  };

  return (
    <nav className="flex w-60 shrink-0 flex-col bg-admin-sidebar py-6">
      <div className="px-5 pb-6">
        <p className="font-semibold text-white">타슈 관리자</p>
        <p className="mt-0.5 text-xs tracking-wide text-admin-sidebar-label">TASHU ADMIN</p>
      </div>

      <ul>
        {MENUS.map(({ to, label, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => `${BASE} ${isActive ? ACTIVE : INACTIVE}`}
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* 하단 프로필·로그아웃 — mt-auto로 사이드바 바닥에 붙인다 */}
      <div className="mt-auto border-t border-white/10 px-5 pt-5">
        <p className="text-sm font-medium text-white">{admin?.name ?? '관리자'}</p>
        <p className="mt-0.5 text-xs text-admin-sidebar-label">{admin?.email ?? ''}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-4 text-sm text-admin-sidebar-label transition-colors hover:text-white"
        >
          로그아웃
        </button>
      </div>
    </nav>
  );
}
