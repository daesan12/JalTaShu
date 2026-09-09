import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

interface TopHeaderProps {
  title?: string;
  /** 뒤로가기 버튼 표시 여부 (기본: 표시). onBack 없으면 브라우저 히스토리 뒤로 */
  showBack?: boolean;
  onBack?: () => void;
  /** 우측 액션 슬롯 */
  right?: ReactNode;
}

export function TopHeader({ title, showBack = true, onBack, right }: TopHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="pt-safe sticky top-0 z-10 bg-surface/90 backdrop-blur-sm">
      <div className="relative flex h-14 items-center px-1.5">
        {showBack && (
          <button
            type="button"
            aria-label="뒤로 가기"
            onClick={onBack ?? (() => navigate(-1))}
            className="flex h-11 w-11 items-center justify-center rounded-full active:bg-gray-100"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-gray-800" fill="none">
              <path
                d="M15 5 8 12l7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        {title && (
          <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-gray-900">
            {title}
          </h1>
        )}
        {right && <div className="ml-auto flex items-center pr-2">{right}</div>}
      </div>
    </header>
  );
}
