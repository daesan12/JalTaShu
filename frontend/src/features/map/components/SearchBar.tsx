interface SearchBarProps {
  onClick: () => void;
  /** 08에서 고른 목적지 이름. 없으면 안내 문구 */
  value?: string | null;
}

/** 목적지 검색 진입점 — 누르면 08 검색 오버레이가 열린다 */
export function SearchBar({ onClick, value = null }: SearchBarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-2.5 rounded-xl bg-surface px-4 text-left shadow-md transition-[scale] duration-75 active:scale-[0.99]"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 text-gray-400">
        <circle
          cx="11"
          cy="11"
          r="6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <path
          d="m16 16 4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </svg>
      {value ? (
        <span className="truncate text-base text-gray-900">{value}</span>
      ) : (
        <span className="text-base text-gray-400">어디로 갈까요?</span>
      )}
    </button>
  );
}
