/**
 * Figma Admin/Badge의 State 5종과 1:1.
 * 라벨이 곧 상태값이라 따로 받지 않는다. 서버 enum(OPEN 등)을 이 라벨로 바꾸는 일은
 * 각 화면에서 하고, 이 컴포넌트는 색만 책임진다.
 */
type AdminBadgeState = '미해결' | '처리중' | '해결됨' | '정상' | '정지';

/** 5종을 색 역할 3개로 묶는다 — 정상은 해결됨과 같은 초록, 정지는 미해결과 같은 빨강 */
const STATE_CLASS: Record<AdminBadgeState, string> = {
  미해결: 'bg-admin-danger-bg text-admin-danger-text',
  처리중: 'bg-admin-warn-bg text-admin-warn-text',
  해결됨: 'bg-admin-ok-bg text-admin-ok-text',
  정상: 'bg-admin-ok-bg text-admin-ok-text',
  정지: 'bg-admin-danger-bg text-admin-danger-text',
};

export function AdminBadge({ state }: { state: AdminBadgeState }) {
  return (
    <span
      className={`inline-flex h-[26px] items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap ${STATE_CLASS[state]}`}
    >
      {state}
    </span>
  );
}
