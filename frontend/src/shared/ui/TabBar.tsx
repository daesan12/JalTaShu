import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

/** Figma Tab Bar v2 기준 — 4탭: 지도 / QR / 기록 / 마이 */
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
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <path d="M12 21s-7-5.1-7-11a7 7 0 0 1 14 0c0 5.9-7 11-7 11Z" {...stroke} />
        <circle cx="12" cy="10" r="2.5" {...stroke} />
      </svg>
    ),
  },
  {
    to: '/rental',
    label: 'QR',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <rect x="4" y="4" width="6" height="6" rx="1" {...stroke} />
        <rect x="14" y="4" width="6" height="6" rx="1" {...stroke} />
        <rect x="4" y="14" width="6" height="6" rx="1" {...stroke} />
        <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17.5 20H20v-2.5" {...stroke} />
      </svg>
    ),
  },
  {
    to: '/history',
    label: '기록',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <circle cx="12" cy="12" r="8.5" {...stroke} />
        <path d="M12 7.5V12l3 2" {...stroke} />
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
