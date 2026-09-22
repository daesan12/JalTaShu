/** 배지 색 (디자인: 브레이크=빨강 계열, 타이어=주황 계열, 나머지=회색) */
const TAG_CLASS: Record<string, string> = {
  브레이크: 'bg-red-50 text-status-low',
  타이어: 'bg-amber-50 text-status-mid',
};

interface TagBadgeProps {
  /** 배지에 찍을 문구 — 고장 부위 태그이거나 '방치 신고' 같은 민원 유형 이름 */
  tag: string;
  /** '기타' 태그의 직접 입력 부위명 — 있으면 배지에 이 텍스트를 표시 */
  detail?: string | null;
}

export function TagBadge({ tag, detail }: TagBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        (TAG_CLASS[tag] ?? 'bg-gray-100 text-gray-600')
      }`}
    >
      {tag === '기타' && detail ? detail : tag}
    </span>
  );
}
