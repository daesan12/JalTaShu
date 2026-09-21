/**
 * 지금 빌려 둔 자전거 — QR을 한 번 더 찍었을 때 대여인지 반납인지 가르는 유일한 근거다.
 *
 * 서버에 "내가 지금 빌린 자전거" 조회 API가 없어서 앱이 기억한다(백엔드에 요청해 둘 것).
 * `localStorage`를 쓰는 이유는 빌린 뒤 앱을 껐다 켜도 반납할 수 있어야 하기 때문 —
 * 메모리에만 두면 앱을 내리는 순간 반납할 방법이 사라진다.
 *
 * 한계: 기기에만 남아서 다른 기기로 반납할 수 없고, 앱 데이터를 지우면 잊는다.
 * 그때는 대여소 시트의 "반납하기"(번호 직접 입력)로 돌아갈 수 있다.
 */
const KEY = 'rented_cycle';

export interface RentalSession {
  cycleId: string;
  /** 대여 시각 (ISO 8601) — 서버가 돌려준 값 */
  rentedAt: string;
}

/** 저장소를 못 쓰는 환경(시크릿 모드 등)에서도 화면은 돌아가야 한다 — 없으면 "빌린 것 없음" */
export function readRentalSession(): RentalSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<RentalSession>;
    if (typeof parsed.cycleId !== 'string' || typeof parsed.rentedAt !== 'string') return null;
    return { cycleId: parsed.cycleId, rentedAt: parsed.rentedAt };
  } catch {
    return null;
  }
}

export function writeRentalSession(session: RentalSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // 저장에 실패해도 대여 자체는 성공했다 — 반납은 대여소 시트로 할 수 있다
  }
}

export function clearRentalSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 지우지 못해도 다음 대여가 덮어쓴다
  }
}
