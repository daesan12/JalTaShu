import type { ButtonHTMLAttributes } from 'react';

/** Figma Chip 변형(State=Default/Selected)과 1:1 */
interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({ selected = false, className = '', children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex min-h-9 items-center justify-center rounded-full border px-4 text-sm font-medium transition-[background-color,border-color,color] duration-75 active:scale-[0.96] ${
        selected
          ? 'border-primary bg-primary-light text-primary'
          : 'border-gray-200 bg-surface text-gray-600 active:bg-gray-50'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
