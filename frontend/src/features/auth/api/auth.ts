import { apiGet, apiPost } from '@/shared/api/client';
import { ENV } from '@/shared/config/env';
import { TERMS, type TermCode } from '@/shared/config/constants';

export interface Me {
  /** null이면 가입(약관·닉네임) 미완료 신규 유저 */
  nickname: string | null;
}

/** GET /api/users/me — 비로그인 시 401 ApiError */
export function getMe(): Promise<Me> {
  return apiGet<Me>('/users/me');
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
  // API_BASE_URL(예: /api 또는 https://서버/api)에서 백엔드 origin을 얻는다
  const backendOrigin = ENV.API_BASE_URL.replace(/\/api\/?$/, '');
  window.location.href = `${backendOrigin}/auth/oauth/kakao`;
}

/**
 * POST /api/auth/sign-up — 약관 동의 + 닉네임 설정.
 * agrees 각 원소는 반드시 [code, version] 2개짜리 배열 (백엔드가 길이 검증을 안 해 500 방지 목적)
 */
export function signUp(agreedCodes: TermCode[], nickname: string): Promise<null> {
  const agrees = TERMS.filter((t) => agreedCodes.includes(t.code)).map((t) => [t.code, t.version]);
  return apiPost<null>('/auth/sign-up', { agrees, nickname });
}
