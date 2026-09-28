/** 이용 이력 표의 "09.17 14:03" — 표가 좁아 연도는 뺀다 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 상세 화면의 "2026.09.01 14:32" — 표와 달리 연도까지 보여준다 */
export function formatDateTimeFull(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * 사용자 식별자 표기 "U-000007" — 백엔드는 숫자 PK만 준다.
 * 관리자 화면에서만 쓰는 표기라 API에 보낼 때는 항상 원래 숫자를 쓴다.
 */
export function formatUserCode(userId: number): string {
  return `U-${String(userId).padStart(6, '0')}`;
}

/**
 * 표의 "닉네임"·"사용자 ID" 두 칸 — 한 칸에 "닉네임 · #7"로 합치면 숫자가 뭔지 알 수 없어 나눈다(#157).
 * 사용자 ID는 사용자 관리와 같은 "U-000007" 표기. 없는 값은 "-".
 * - 닉네임만 없음: 소셜 로그인만 하고 가입을 끝내지 않은 사용자
 * - 사용자 자체가 없음: 앱을 거치지 않은 이용 이력
 */
export function formatUserCells(
  nickname: string | null,
  userId: number | null,
): { nickname: string; userCode: string } {
  if (userId === null || userId === undefined) return { nickname: '-', userCode: '-' };
  return { nickname: nickname || '-', userCode: formatUserCode(userId) };
}

/**
 * Date → 백엔드 LocalDateTime 문자열 "2026-09-28T14:12:33".
 * toISOString()은 UTC로 바꾸고 'Z'를 붙여 Jackson의 LocalDateTime 파싱이 깨진다.
 */
export function toLocalDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}
