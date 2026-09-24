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
 * 표의 "이용자"·"제보자" 칸 — 사용자 연결 여부와 닉네임 설정 여부를 구분한다.
 *
 * 두 가지 경우가 있고 뜻이 다르다.
 * - 닉네임만 없음: 소셜 로그인만 하고 가입을 끝내지 않은 사용자
 * - 사용자 자체가 없음: 앱을 거치지 않은 이용 이력
 */
export function formatUserName(nickname: string | null, userId: number | null): string {
  if (userId === null || userId === undefined) return '연결된 사용자 없음';
  if (!nickname) return `닉네임 미설정 · #${userId}`;
  return `${nickname} · #${userId}`;
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
