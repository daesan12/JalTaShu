import { NavLink } from 'react-router';

/** Figma Admin/Sidebar의 Active 5종과 1:1. 순서도 Figma 그대로다. */
const MENUS = [
  { to: '/admin', label: '히트맵', end: true },
  { to: '/admin/users', label: '사용자 관리', end: false },
  { to: '/admin/bikes', label: '자전거 관리', end: false },
  { to: '/admin/reports', label: '제보 관리', end: false },
  { to: '/admin/notices', label: '공지사항', end: false },
];

/** 활성 표시는 배경 + 왼쪽 3px 인디케이터 두 가지. 비활성도 같은 폭의 투명 테두리를 둬야 글자가 밀리지 않는다. */
const BASE = 'block border-l-[3px] py-2.5 pr-4 pl-[17px] text-sm transition-colors';
const ACTIVE = 'border-admin-indicator bg-admin-sidebar-active font-medium text-white';
const INACTIVE = 'border-transparent text-admin-sidebar-label hover:text-white';

export function AdminSidebar() {
  return (
    <nav className="w-60 shrink-0 bg-admin-sidebar py-6">
      <p className="px-5 pb-6 font-semibold text-white">잘타슈 관리자</p>
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
    </nav>
  );
}
