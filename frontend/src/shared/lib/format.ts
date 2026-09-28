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
export function formatDate(iso: string | null | undefined): string {
  // 서버가 시각을 비워 보내는 기록이 있다 — 화면이 죽는 것보다 빈 표시가 낫다
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
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

const SEOUL_DATE_TIME = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/**
 * 시각(ms) → 백엔드 LocalDateTime 문자열 "2026-09-24T14:12:33" (Asia/Seoul 기준).
 * `toISOString()`은 UTC에 'Z'를 붙여, 서버가 Z를 떼고 읽으면 9시간 어긋난 값이 저장된다.
 * 기기 시간대가 아니라 서울로 고정한다 — 서버의 대여·반납 시각이 서울 기준이다.
 */
export function toSeoulLocalDateTime(ms: number): string {
  const parts = Object.fromEntries(
    SEOUL_DATE_TIME.formatToParts(new Date(ms)).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
