/** 페이지 번호 표시용 윈도잉: 1 2 3 … 8 형태 (현재 페이지 주변 + 양 끝, 간격은 말줄임) */
export const ELLIPSIS = '…' as const;
export type PageItem = number | typeof ELLIPSIS;

export function getPageItems(current: number, total: number): PageItem[] {
  if (total <= 1) return total === 1 ? [1] : [];

  const wanted = new Set<number>([1, total, current - 1, current, current + 1]);
  // 끝단에서는 창을 3개로 유지 (1페이지에서도 1 2 3 … 8 형태가 되도록)
  if (current <= 2) wanted.add(3);
  if (current >= total - 1) wanted.add(total - 2);

  const pages = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const items: PageItem[] = [];
  let prev = 0;
  for (const page of pages) {
    if (prev && page - prev === 2) items.push(prev + 1); // 간격 1칸이면 말줄임 대신 그 숫자
    else if (prev && page - prev > 2) items.push(ELLIPSIS);
    items.push(page);
    prev = page;
  }
  return items;
}
