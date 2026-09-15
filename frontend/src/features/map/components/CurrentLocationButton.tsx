interface CurrentLocationButtonProps {
  onClick: () => void;
  /** 위치 조회 중 — 연타를 막고 조회가 돌고 있다는 것을 보여준다 */
  loading?: boolean;
}

/** 현재 위치로 지도를 옮기는 버튼 */
export function CurrentLocationButton({ onClick, loading = false }: CurrentLocationButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label="현재 위치로 이동"
      aria-busy={loading}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-gray-600 shadow-md transition-[scale,background-color] duration-75 active:scale-95 active:bg-gray-100 disabled:pointer-events-none disabled:opacity-60"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`}
      >
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
