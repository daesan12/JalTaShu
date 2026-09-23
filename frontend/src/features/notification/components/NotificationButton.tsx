interface NotificationButtonProps {
  onClick: () => void;
}

/** 지도 검색창 아래에서 개인 알림 목록으로 들어가는 플로팅 버튼. */
export function NotificationButton({ onClick }: NotificationButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="알림 목록 보기"
      className="pointer-events-auto relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line/90 bg-surface/95 text-gray-700 shadow-[0_6px_18px_rgba(24,33,21,0.14)] backdrop-blur-md transition-[scale,background-color] duration-75 active:scale-95 active:bg-surface-soft"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5.5 w-5.5">
        <path
          d="M18 9a6 6 0 0 0-12 0c0 6.5-2.75 6.75-2.75 8.25h17.5C20.75 15.75 18 15.5 18 9Z"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M9.75 20h4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    </button>
  );
}
