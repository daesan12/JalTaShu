interface CurrentLocationButtonProps {
  onClick: () => void;
}

/**
 * 현재 위치로 지도를 옮기는 버튼.
 * 지금은 눌러도 안내만 뜬다 — 지도 연동 이슈에서 실제 이동을 붙인다.
 */
export function CurrentLocationButton({ onClick }: CurrentLocationButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="현재 위치로 이동"
      className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-gray-600 shadow-md transition-[scale,background-color] duration-75 active:scale-95 active:bg-gray-100"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth={1.8} />
        <path
          d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
