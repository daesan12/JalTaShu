import type { ReactNode } from 'react';

/** 상세 페이지의 탭 줄 — 밑줄 하나를 공유하고 버튼이 -mb-px로 겹친다 */
export function AdminTabBar({ children }: { children: ReactNode }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-admin-line">
      {children}
    </div>
  );
}

interface AdminTabButtonProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function AdminTabButton({ active, onClick, children }: AdminTabButtonProps) {
  return (
    <button
      type="button"
      aria-selected={active}
      role="tab"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'border-admin-indicator text-admin-text'
          : 'border-transparent text-admin-muted hover:text-admin-text'
      }`}
    >
      {children}
    </button>
  );
}
