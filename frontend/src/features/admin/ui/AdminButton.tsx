import type { ButtonHTMLAttributes } from 'react';

/** Figma Admin/Button의 Type 4종과 1:1 */
type AdminButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

/** Figma에 나오는 높이 세 가지 — 표 안 32, 기본 38, 로그인 44 */
type AdminButtonSize = 'sm' | 'md' | 'lg';

interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  /** 부모 폭 꽉 채우기 (로그인 화면) */
  full?: boolean;
}

const VARIANT_CLASS: Record<AdminButtonVariant, string> = {
  primary: 'bg-admin-primary text-white hover:bg-admin-primary-hover',
  secondary: 'border border-admin-line bg-admin-bg text-admin-text hover:bg-admin-panel',
  danger: 'bg-admin-danger text-white hover:bg-admin-danger-hover',
  ghost: 'text-admin-muted hover:bg-admin-panel hover:text-admin-text',
};

const SIZE_CLASS: Record<AdminButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-[38px] px-4 text-sm',
  lg: 'h-11 px-4 text-[15px]',
};

/** 마우스 전용이라 모바일 Button과 달리 hover만 있고 active:scale은 두지 않는다 */
export function AdminButton({
  variant = 'primary',
  size = 'md',
  full = false,
  className = '',
  type = 'button',
  children,
  ...props
}: AdminButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${full ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
