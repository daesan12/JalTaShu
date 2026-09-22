interface NoticeBannerProps {
  onClick: () => void;
}

/**
 * 검색바 아래 공지사항 목록 진입점.
 * 문구는 고정 — 최신 공지 제목을 띄우려면 공지 목록 API가 필요해 후속으로 미룬다.
 */
export function NoticeBanner({ onClick }: NoticeBannerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface/95 px-3.5 text-gray-700 shadow-sm backdrop-blur-md transition-[scale,background-color] duration-75 active:scale-[0.98] active:bg-surface-soft"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 text-primary">
        <path
          d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18C21 15 18 15 18 8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 20h4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[13px] font-semibold">공지사항</span>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-gray-400">
        <path
          d="m9 5 7 7-7 7"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
