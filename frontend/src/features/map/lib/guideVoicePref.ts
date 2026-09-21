import { STORAGE_KEYS } from '@/shared/config/constants';

/**
 * 12 안내 음성 켜짐/꺼짐 기억 (2026-09-21 결정).
 *
 * **기본값은 켜짐이다.** 자전거는 화면을 볼 수 없는 이동수단이라 음성이 부가기능이 아니고,
 * 기본을 꺼 두면 정작 필요한 사람이 주행 중에 토글을 눌러야 해 위험하다. 티맵·카카오내비·
 * 네이버지도도 모두 기본 ON이다.
 *
 * 그래서 **"껐다"만 저장한다.** 키가 없으면 켜짐이므로 처음 쓰는 사람도, 저장소를 지운 사람도
 * 음성이 나온다. 껐던 사람만 그 선택이 다음 주행까지 따라간다.
 */

export function readVoiceOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.guideVoiceOff) !== 'true';
  } catch {
    // 사파리 프라이빗 모드 등 저장소를 못 읽는 환경 — 기본값(켜짐)으로 간다
    return true;
  }
}

export function writeVoiceOn(on: boolean): void {
  try {
    if (on) localStorage.removeItem(STORAGE_KEYS.guideVoiceOff);
    else localStorage.setItem(STORAGE_KEYS.guideVoiceOff, 'true');
  } catch {
    // 저장에 실패해도 이번 주행에는 반영돼 있다
  }
}
