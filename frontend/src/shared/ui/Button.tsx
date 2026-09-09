import type { ButtonHTMLAttributes } from 'react';

/** Figma Button 변형(Type=Primary/Line/Text/Kakao)과 1:1 */
type ButtonVariant = 'primary' | 'line' | 'text' | 'kakao';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** 부모 폭 꽉 채우기 */
  full?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white active:bg-primary-dark',
  line: 'border border-primary text-primary bg-surface active:bg-primary-light',
  text: 'text-primary active:bg-primary-light',
  kakao: 'bg-kakao text-black/85 active:brightness-95',
};

export function Button({
  variant = 'primary',
  full = false,
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-semibold transition-[scale,background-color] duration-75 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${VARIANT_CLASS[variant]} ${full ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
