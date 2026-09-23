import type { SaveUsagePathInput } from '@/features/history/api/rides';

/**
 * 반납보다 먼저 "도착 완료"를 누른 안내 경로.
 *
 * 경로는 반납 응답의 이용 기록 ID에 붙는데, 목적지 대여소에 도착해 "도착 완료"를 먼저 누르고
 * 자전거는 그다음에 반납하는 경우가 흔하다. 그 사이 안내는 이미 끝났으므로 경로를 여기 맡겨 두고,
 * 같은 자전거의 반납이 성공하면 그 기록에 붙인다.
 * 다른 탭에 다녀와도(지도 화면이 다시 마운트돼도) 남도록 localStorage에 둔다.
 */
const KEY = 'pending_usage_path';

/** 이보다 오래 반납하지 않았으면 그 안내와 반납은 같은 이용으로 보기 어렵다 */
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

export interface PendingUsagePath {
  /** 도착 완료를 누를 때 빌려 둔 자전거 — 다른 자전거의 반납에 붙지 않게 */
  cycleId: string;
  /** 도착 완료 시각(ms) */
  savedAt: number;
  path: Omit<SaveUsagePathInput, 'cycleUsageId'>;
}

export function writePendingUsagePath(pending: PendingUsagePath): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    // 저장하지 못하면 이 경로만 기록에서 빠진다
  }
}

/** 해당 자전거의 맡겨 둔 경로를 꺼낸다(꺼내면 지운다). 없거나 오래됐으면 null */
export function takePendingUsagePath(cycleId: string, now = Date.now()): PendingUsagePath | null {
  let pending: PendingUsagePath | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    pending = JSON.parse(raw) as PendingUsagePath;
    localStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (
    pending === null ||
    typeof pending.cycleId !== 'string' ||
    typeof pending.savedAt !== 'number' ||
    typeof pending.path !== 'object' ||
    pending.path === null
  ) {
    return null;
  }
  if (pending.cycleId !== cycleId || now - pending.savedAt > MAX_AGE_MS) return null;
  return pending;
}
