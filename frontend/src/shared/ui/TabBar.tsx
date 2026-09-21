import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

/** Figma Tab Bar v2 기준 — 4탭: 지도 / 민원 / 이동 기록 / 마이 */
interface TabItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

const TABS: TabItem[] = [
  {
    to: '/',
    label: '지도',
    icon: (
      // 접힌 지도
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" {...stroke} />
        <path d="M9 4v14M15 6v14" {...stroke} />
      </svg>
    ),
  },
  {
    to: '/report',
    label: '민원',
    icon: (
      // 느낌표 말풍선
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <path
          d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6l-4 3.5V17H6a2 2 0 0 1-2-2V6Z"
          {...stroke}
        />
        <path d="M12 7.5V11" {...stroke} />
        <path d="M12 13.8v.01" {...stroke} strokeWidth={2.4} />
      </svg>
    ),
  },
  {
    to: '/history',
    label: '이동 기록',
    icon: (
      // 경로 (점-곡선-점)
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <circle cx="6" cy="18" r="2.2" {...stroke} />
        <circle cx="18" cy="6" r="2.2" {...stroke} />
        <path
          d="M8 16.5c3-1 2.5-4 5-6 1.2-1 2.2-1.6 3.2-2.6"
          {...stroke}
          strokeDasharray="0.1 3.2"
        />
      </svg>
    ),
  },
  {
    to: '/mypage',
    label: '마이',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <circle cx="12" cy="8" r="3.5" {...stroke} />
        <path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" {...stroke} />
      </svg>
    ),
  },
];

export function TabBar() {
  return (
    <nav className="pb-safe z-20 border-t border-gray-100 bg-surface">
      <div className="flex h-16">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 transition-[color] duration-75 ${
                isActive ? 'text-primary' : 'text-gray-400 active:text-gray-500'
              }`
            }
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
