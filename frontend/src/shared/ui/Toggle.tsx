interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

/** Figma Toggle 변형(State=On/Off)과 1:1 */
export function Toggle({ checked, onChange, disabled, ...aria }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 min-w-11 items-center justify-center disabled:opacity-40"
      {...aria}
    >
      <span
        className={`relative h-7 w-12 rounded-full transition-[background-color] duration-150 ${
          checked ? 'bg-primary' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-[translate] duration-150 ease-out ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  );
}
