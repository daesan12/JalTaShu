/** 미터 → "350m" / "1.2km" */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** 분 → "5분" / "1시간 10분" */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}시간` : `${h}시간 ${rest}분`;
}

/** ISO 시각 → "2026.08.28" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** ISO 시각 또는 epoch(ms) → "10초 전" / "3분 전" / "5시간 전" / "3일 전" / "2주 전" */
export function formatTimeAgo(at: string | number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(at).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}초 전`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}시간 전`;
  if (diffSec < 7 * 86_400) return `${Math.floor(diffSec / 86_400)}일 전`;
  return `${Math.floor(diffSec / (7 * 86_400))}주 전`;
}
