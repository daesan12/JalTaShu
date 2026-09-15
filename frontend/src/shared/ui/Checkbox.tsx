import type { ReactNode } from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
  disabled?: boolean;
}

/** Figma Checkbox 변형(State=On/Off)과 1:1 — 라벨 포함 44px 터치 타깃 */
export function Checkbox({ checked, onChange, children, disabled }: CheckboxProps) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-2.5 ${disabled ? 'opacity-40' : ''}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md border transition-[background-color,border-color] duration-75 ${
          checked ? 'border-primary bg-primary' : 'border-gray-300 bg-surface'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
            <path
              d="M2 6.2 4.8 9 10 3.4"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {children && <span className="text-[15px] text-gray-800">{children}</span>}
    </label>
  );
}
