import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

/** Figma ControlBar 기준 높이 36px. 테두리·포커스는 세 컨트롤이 같이 쓴다. */
const CONTROL =
  'h-9 rounded-md border border-admin-line bg-admin-bg px-3 text-sm text-admin-text ' +
  'placeholder:text-admin-muted focus:border-admin-indicator focus:ring-1 focus:ring-admin-indicator focus:outline-none';

/** 목록 위에 놓이는 검색·필터 줄. 어떤 컨트롤을 넣을지는 화면마다 다르다. */
export function AdminFilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

/** 폭은 화면마다 달라 className으로 준다 (예: w-80) */
export function AdminSearchInput({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="search" className={`${CONTROL} ${className}`} {...props} />;
}

/** option은 호출하는 쪽에서 children으로 넣는다 */
export function AdminSelect({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${CONTROL} ${className}`} {...props}>
      {children}
    </select>
  );
}

/** 단일 날짜 선택 (01 히트맵의 조회 날짜) */
export function AdminDateInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="date" className={`${CONTROL} ${className}`} {...props} />;
}

interface AdminDateRangeProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

/** 03 제보 관리·06 공지사항의 "2026-08-01 ~ 2026-09-02" */
export function AdminDateRange({ from, to, onFromChange, onToChange }: AdminDateRangeProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={from}
        max={to || undefined}
        onChange={(event) => onFromChange(event.target.value)}
        className={CONTROL}
        aria-label="시작일"
      />
      <span className="text-admin-muted">~</span>
      <input
        type="date"
        value={to}
        min={from || undefined}
        onChange={(event) => onToChange(event.target.value)}
        className={CONTROL}
        aria-label="종료일"
      />
    </div>
  );
}
