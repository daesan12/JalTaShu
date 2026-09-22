interface PinIconProps {
  /** 켜져 있으면 채운 핀, 꺼져 있으면 윤곽선만 */
  filled: boolean;
  className?: string;
}

/**
 * 공지 목록의 팝업 고정 아이콘.
 *
 * 켜짐/꺼짐을 **색만으로 구분하지 않는다** — 채움 여부가 같이 달라져야 색을 구분하기 어려운
 * 사용자도 상태를 읽을 수 있다. 상태 문구는 버튼 쪽 aria-label이 맡는다.
 */
export function PinIcon({ filled, className }: PinIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M9 4h6l-1 5 3 3v2h-4.5v5l-.5 1-.5-1v-5H7v-2l3-3-1-5z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}
