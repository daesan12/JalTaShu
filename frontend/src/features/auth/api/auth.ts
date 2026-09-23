import { Capacitor } from '@capacitor/core';
import { apiGet, apiPatch, apiPost, setAccessToken } from '@/shared/api/client';
import { ENV } from '@/shared/config/env';
import { TERMS, type TermCode } from '@/shared/config/constants';
import { deactivateStoredPushToken } from '@/features/notification/lib/pushNotifications';

/** GET /users/me 응답 (백엔드 UserMeResponse) — 월간 통계는 매달 1일 0시(KST) 기준 리셋 */
export interface Me {
  /** null이면 가입(약관·닉네임) 미완료 신규 유저 */
  nickname: string | null;
  /** 이번 달 이동 횟수 */
  monthlyMoveCnt: number;
  /** 이번 달 이동 거리(km, 소수 1자리) — 이동 기록이 없으면 null */
  monthlyMoveDis: number | null;
  /** 이번 달 자전거 이용 시간(분) */
  monthlyTime: number;
}

/**
 * GET /api/users/me — 로그인 여부 확인 겸 내 정보 조회 (전역 리다이렉트 제외).
 * 401 = 비로그인, 403 = 로그인은 됐지만 가입 미완료(GUEST 권한이라 시큐리티 필터가 자름).
 * 403 → "가입 필요" 해석은 useAuth가 담당한다.
 */
export function getMe(): Promise<Me> {
  return apiGet<Me>('/users/me', { skipAuthRedirect: true });
}

/**
 * 카카오 로그인 결과.
 * - completed: 로그인 흐름이 끝났으니 세션을 다시 확인하고 다음 화면으로 (msw mock·앱 인앱 로그인)
 * - redirecting: 카카오로 페이지를 떠나는 중 — 호출한 쪽은 **아무것도 하면 안 된다**.
 *   location.href 대입은 페이지를 즉시 떠나지 않아서, 이후에 라우터 내비게이션을 하면
 *   브라우저가 대기 중인 카카오 이동을 취소해 버린다(staging에서 /staging/으로 튕기던 버그)
 * - cancelled: 사용자가 인앱 로그인 창을 닫음 — 로그인 화면으로 복귀
 */
export type KakaoLoginResult = 'completed' | 'redirecting' | 'cancelled';

/**
 * 카카오 로그인 시작 — 백엔드 주도 OAuth라 전체 페이지 이동.
 * msw 모드에서는 실제 카카오로 갈 수 없으므로 mock 로그인 API를 호출하고,
 * 앱(Capacitor)에서는 외부 브라우저로 나가면 쿠키가 앱 밖에 발급되므로
 * 인앱 WebView 오버레이로 로그인을 진행한다(#94).
 */
export async function startKakaoLogin(): Promise<KakaoLoginResult> {
  if (ENV.ENABLE_MSW) {
    await apiPost<null>('/auth/mock-login');
    return 'completed';
  }
  // OAuth 경로는 API(/api)와 별개라 전용 env(VITE_AUTH_BASE_URL)를 사용 (staging에서 경로가 다름).
  // 인앱 창은 절대 URL이 필요하다 — 웹 빌드의 상대 경로 env도 현재 오리진 기준으로 절대화
  const oauthUrl = new URL(`${ENV.AUTH_BASE_URL}/oauth/kakao`, window.location.origin).toString();
  if (Capacitor.isNativePlatform()) {
    const { openKakaoLoginOverlay } = await import('@/features/auth/lib/inAppOAuth');
    return openKakaoLoginOverlay(oauthUrl);
  }
  window.location.href = oauthUrl;
  return 'redirecting';
}

/** PATCH /api/users/me — 닉네임 변경 (백엔드 UserNicknameRequestDto 실측) */
export function updateNickname(nickname: string): Promise<null> {
  return apiPatch<null>('/users/me', { nickname });
}

/** POST /api/auth/logout — 서버가 refresh를 폐기하고 쿠키를 만료시킨다. 메모리 토큰도 지운다 */
export async function logout(): Promise<void> {
  try {
    await deactivateStoredPushToken();
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
