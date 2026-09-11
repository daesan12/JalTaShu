import { STORAGE_KEYS } from '@/shared/config/constants';

/** "7일간 보지 않기"를 누른 뒤 팝업을 다시 띄우지 않는 기간 */
const HIDE_DAYS = 7;

/**
 * 이번 실행에서 팝업을 이미 닫았는지.
 * 화면 컴포넌트가 아니라 모듈에 둬야 지도 ↔ 공지사항을 오갈 때 다시 뜨지 않는다.
 * 새로고침(앱 재실행)하면 초기화된다.
 */
let closedInSession = false;

export function markNoticePopupClosed(): void {
  closedInSession = true;
}

/**
 * 팝업을 띄우지 말아야 하는지 — 이번 실행에서 닫았거나, "7일간 보지 않기"가 살아 있으면 true.
 * 숨김은 팝업 묶음 전체에 적용한다(팝업 한 장 단위가 아님).
 * 저장값은 다시 띄워도 되는 시각(ms). 기기 단위 저장이라 계정을 바꿔도 유지된다.
 */
export function isNoticePopupHidden(): boolean {
  if (closedInSession) return true;

  try {
    const until = Number(localStorage.getItem(STORAGE_KEYS.noticePopupHiddenUntil));
    return Date.now() < until;
  } catch {
    // 저장소를 못 읽으면 그냥 띄운다
    return false;
  }
}

export function hideNoticePopupForWeek(): void {
  try {
    const until = Date.now() + HIDE_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEYS.noticePopupHiddenUntil, String(until));
  } catch {
    // 저장에 실패하면 다음 진입 때 다시 뜬다 — 팝업을 닫는 것 자체는 막지 않는다
  }
}
