interface StationVisibilityToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

/** 지도 도구 막대에서 대여소 마커만 숨기거나 다시 표시한다. */
export function StationVisibilityToggle({ enabled, onToggle }: StationVisibilityToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={`대여소 마커 ${enabled ? '끄기' : '켜기'}`}
      className={`flex h-11 min-w-[62px] items-center justify-center gap-1.5 rounded-[14px] px-2 transition-[color,background-color,scale] duration-150 active:scale-95 ${
        enabled ? 'bg-primary-light text-primary' : 'text-muted active:bg-surface-soft'
      }`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
        <circle cx="6.5" cy="16.5" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.5" cy="16.5" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="m6.5 16.5 4-7 3.5 7m-5.8-4h8.3M10.5 9.5H8.7m5.3 7 2.1-8h2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        aria-hidden="true"
        className={`relative h-4 w-6 rounded-full transition-colors duration-150 ${
          enabled ? 'bg-primary' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${
            enabled ? 'translate-x-2' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}
