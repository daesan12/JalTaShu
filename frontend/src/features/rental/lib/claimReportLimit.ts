/**
 * 허위 제보 신고의 하루 횟수·중복 가드.
 *
 * ⚠ 백엔드 `reportCycleClaim`은 접수만 하고 횟수 제한도 중복 검사도 하지 않는다(2026-09-18 확인).
 * 그래서 이건 **같은 기기에서의 연발 신고를 막는 화면 쪽 가드**일 뿐, 진짜 제한이 아니다.
 * 서버에 제한이 생기면 그 응답을 기준으로 바꾼다(브라우저 저장소를 지우면 초기화된다).
 */

export const DAILY_REPORT_LIMIT = 3;

const STORAGE_KEY = 'claim_report_log';

export interface ReportLog {
  /** 'YYYY-MM-DD' (기기 시간대 기준 — 자정에 초기화) */
  date: string;
  /** 오늘 신고한 제보 id */
  claimIds: number[];
}

/** 로컬 자정을 기준으로 하루를 가른다 — UTC로 자르면 한국에서 오전 9시에 초기화된다 */
export function toDateKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** 날짜가 바뀌었거나 기록이 없으면 빈 기록으로 되돌린다 */
export function rollOver(log: ReportLog | null, today: string): ReportLog {
  if (log === null || log.date !== today) return { date: today, claimIds: [] };
  return log;
}

/** 같은 제보를 두 번 세지 않는다 — 중복 신고는 애초에 버튼이 막히지만 방어적으로 */
export function addClaim(log: ReportLog, claimId: number): ReportLog {
  if (log.claimIds.includes(claimId)) return log;
  return { ...log, claimIds: [...log.claimIds, claimId] };
}

export function isExhausted(log: ReportLog): boolean {
  return log.claimIds.length >= DAILY_REPORT_LIMIT;
}

/** 오늘 기록을 읽는다. 저장소를 못 쓰는 환경에서도 화면은 뜨도록 빈 기록으로 떨어진다 */
export function readReportLog(now: Date = new Date()): ReportLog {
  const today = toDateKey(now);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return rollOver(raw === null ? null : (JSON.parse(raw) as ReportLog), today);
  } catch {
    return { date: today, claimIds: [] };
  }
}

/** 신고 성공을 기록하고 갱신된 기록을 돌려준다 */
export function recordReport(claimId: number, now: Date = new Date()): ReportLog {
  const next = addClaim(readReportLog(now), claimId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 저장 불가 환경에서도 이번 신고 자체는 이미 접수됐으므로 무시한다
  }
  return next;
}
