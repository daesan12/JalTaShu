import { apiGet, apiPost, apiPut, setAccessToken } from '@/shared/api/client';
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
 *
 * @returns mock 로그인으로 처리됐으면 true(SPA 흐름 계속), 카카오로 떠나는 중이면 false.
 * false면 호출한 쪽은 **아무것도 하면 안 된다** — location.href 대입은 페이지를 즉시
 * 떠나지 않아서, 이후에 라우터 내비게이션을 하면 브라우저가 대기 중인 카카오 이동을
 * 취소해 버린다(staging에서 /staging/으로 튕기던 버그).
 */
export async function startKakaoLogin(): Promise<boolean> {
  if (ENV.ENABLE_MSW) {
    await apiPost<null>('/auth/mock-login');
    return true;
  }
  // OAuth 경로는 API(/api)와 별개라 전용 env(VITE_AUTH_BASE_URL)를 사용 (staging에서 경로가 다름)
  window.location.href = `${ENV.AUTH_BASE_URL}/oauth/kakao`;
  return false;
}

/** PUT /api/users/me — 닉네임 변경 (백엔드 API 미정, msw 목업 기준 임시 스키마) */
export function updateNickname(nickname: string): Promise<null> {
  return apiPut<null>('/users/me', { nickname });
}

/** POST /api/auth/logout — 서버가 refresh를 폐기하고 쿠키를 만료시킨다. 메모리 토큰도 지운다 */
export async function logout(): Promise<void> {
  try {
    await apiPost<null>('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

/** POST /api/users/withdraw — 회원 탈퇴 (백엔드 API 미정, msw 목업 기준 임시 스키마) */
export function withdraw(reason: string): Promise<null> {
  return apiPost<null>('/users/withdraw', { reason });
}

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

/**
 * POST /api/auth/sign-up — 약관 동의 + 닉네임 설정.
 * agrees 각 원소는 반드시 [code, version] 2개짜리 배열 (백엔드가 길이 검증을 안 해 500 방지 목적).
 * 백엔드가 새 access token을 돌려주므로(권한 버전 갱신) 바로 갈아 끼운다.
 */
export async function signUp(agreedCodes: TermCode[], nickname: string): Promise<void> {
  const agrees = TERMS.filter((t) => agreedCodes.includes(t.code)).map((t) => [t.code, t.version]);
  const res = await apiPost<TokenResponse>('/auth/sign-up', { agrees, nickname });
  setAccessToken(res.accessToken);
}
