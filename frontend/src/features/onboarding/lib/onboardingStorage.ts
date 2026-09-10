import { STORAGE_KEYS } from '@/shared/config/constants';

export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.onboardingDone) === 'true';
  } catch {
    return true; // 저장소를 못 쓰는 환경이면 온보딩을 건너뛴다
  }
}

export function markOnboardingDone() {
  try {
    localStorage.setItem(STORAGE_KEYS.onboardingDone, 'true');
  } catch {
    // 저장 실패 시 다음 실행에 온보딩이 다시 보이는 것뿐이라 무시
  }
}
