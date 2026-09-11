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
      className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-primary bg-surface px-4 transition-[scale] duration-75 active:scale-[0.99]"
    >
      {/* 오른쪽 화살표와 같은 폭을 왼쪽에 둬서 문구가 정확히 가운데 오게 한다 */}
      <span aria-hidden="true" className="w-4 shrink-0" />
      <span className="flex-1 text-center text-sm font-medium text-gray-800">
        공지사항 확인하기
      </span>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400">
        <path
          d="m9 5 7 7-7 7"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
