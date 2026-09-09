import type { ReactNode } from 'react';

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** 좌측 아이콘·이미지 슬롯 */
  left?: ReactNode;
  /** 우측 슬롯 (기본: chevron) */
  right?: ReactNode;
  onClick?: () => void;
}

export function ListRow({ title, subtitle, left, right, onClick }: ListRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-gray-50"
    >
      {left && <span className="shrink-0">{left}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-gray-900">{title}</span>
        {subtitle && <span className="block truncate text-sm text-gray-500">{subtitle}</span>}
      </span>
      <span className="shrink-0 text-gray-300">
        {right ?? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path
              d="m9 5 7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
