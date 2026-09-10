import { apiGet, apiPost, apiPut } from '@/shared/api/client';
import { ENV } from '@/shared/config/env';
import { TERMS, type TermCode } from '@/shared/config/constants';

export interface Me {
  /** null이면 가입(약관·닉네임) 미완료 신규 유저 */
  nickname: string | null;
}

/** GET /api/users/me — 비로그인 시 401 ApiError (로그인 여부 확인용이라 전역 리다이렉트 제외) */
export function getMe(): Promise<Me> {
  return apiGet<Me>('/users/me', { skipAuthRedirect: true });
}

/**
 * 카카오 로그인 시작 — 백엔드 주도 OAuth라 전체 페이지 이동.
 * msw 모드에서는 실제 카카오로 갈 수 없으므로 mock 로그인 API를 호출한다.
 */
export async function startKakaoLogin(): Promise<void> {
  if (ENV.ENABLE_MSW) {
    await apiPost<null>('/auth/mock-login');
    return;
  }
  // OAuth 경로는 API(/api)와 별개라 전용 env(VITE_AUTH_BASE_URL)를 사용 (staging에서 경로가 다름)
  window.location.href = `${ENV.AUTH_BASE_URL}/oauth/kakao`;
}

/** PUT /api/users/me — 닉네임 변경 (백엔드 API 미정, msw 목업 기준 임시 스키마) */
export function updateNickname(nickname: string): Promise<null> {
  return apiPut<null>('/users/me', { nickname });
}

/** POST /api/auth/logout — 백엔드에 아직 없음(요청 필요), msw 목업으로 동작 */
export function logout(): Promise<null> {
  return apiPost<null>('/auth/logout');
}

/**
 * POST /api/auth/sign-up — 약관 동의 + 닉네임 설정.
 * agrees 각 원소는 반드시 [code, version] 2개짜리 배열 (백엔드가 길이 검증을 안 해 500 방지 목적)
 */
export function signUp(agreedCodes: TermCode[], nickname: string): Promise<null> {
  const agrees = TERMS.filter((t) => agreedCodes.includes(t.code)).map((t) => [t.code, t.version]);
  return apiPost<null>('/auth/sign-up', { agrees, nickname });
}
