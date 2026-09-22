import type { ButtonHTMLAttributes } from 'react';

/** Figma Button 변형(Type=Primary/Line/Text/Kakao)과 1:1 */
type ButtonVariant = 'primary' | 'line' | 'text' | 'kakao';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** 부모 폭 꽉 채우기 */
  full?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white shadow-[0_6px_16px_rgba(76,138,18,0.18)] hover:bg-primary-dark active:bg-primary-dark',
  line: 'border border-primary bg-surface text-primary hover:bg-primary-light active:bg-primary-light',
  text: 'text-primary hover:bg-primary-light active:bg-primary-light',
  kakao: 'bg-kakao text-black/85 hover:brightness-[0.98] active:brightness-95',
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
      className={`inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-semibold transition-[transform,background-color,box-shadow,filter] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 active:translate-y-px active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40 motion-reduce:transform-none motion-reduce:transition-none ${VARIANT_CLASS[variant]} ${full ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
