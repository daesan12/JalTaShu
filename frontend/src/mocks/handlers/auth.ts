import { delay, http, HttpResponse } from 'msw';
import {
  NICKNAME_MAX,
  NICKNAME_MIN,
  NICKNAME_PATTERN,
  TERMS,
} from '@/shared/config/constants';
import { fail, getAuthState, ok, requireAuth, setAuthState } from '@/mocks/core';
import { setMockReports } from '@/mocks/handlers/reports';
import { setOpenApiRequests } from '@/mocks/handlers/support';

/** 인증·프로필 (05~06 로그인·가입, 24 마이) */
export const authHandlers = [
  /**
   * access token 재발급 — 실서버는 httpOnly refresh 쿠키를 검증해 새 access token을 준다.
   * 목업은 쿠키가 없으므로 가짜 세션이 살아 있으면 가짜 토큰을 돌려준다.
   * (`shared/api/client.ts`가 401을 받으면 이 경로로 한 번 재발급을 시도한다)
   */
  http.post('/api/auth/token/refresh', async () => {
    await delay(200);
    if (!getAuthState().loggedIn) return fail(401, '로그인이 필요합니다.');
    return HttpResponse.json(
      ok({ accessToken: 'msw-access-token', tokenType: 'Bearer', expiresIn: 1800 }),
    );
  }),

  http.get('/api/users/me', async () => {
    await delay(300);
    const state = getAuthState();
    if (!state.loggedIn) return fail(401, '로그인이 필요합니다.');
    // 실서버 계약: 가입(약관·닉네임) 전 GUEST는 권한이 없어 403 — useAuth가 "가입 필요"로 해석
    if (state.nickname === null) return fail(403, '접근 권한이 없습니다.');
    // UserMeResponse — 월간 통계 (거리 km 소수 1자리, 시간 분)
    return HttpResponse.json(
      ok({ nickname: state.nickname, monthlyMoveCnt: 6, monthlyMoveDis: 18.3, monthlyTime: 97 }),
    );
  }),

  http.put('/api/users/me', async ({ request }) => {
    await delay(400);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const body = (await request.json()) as { nickname?: string };
    const nickname = body.nickname ?? '';
    if (
      nickname.length < NICKNAME_MIN ||
      nickname.length > NICKNAME_MAX ||
      !NICKNAME_PATTERN.test(nickname)
    ) {
      return fail(400, '닉네임 형식이 올바르지 않습니다.');
    }
    setAuthState({ loggedIn: true, nickname });
    return HttpResponse.json({ code: 200, message: '닉네임이 변경되었습니다.', data: null });
  }),

  // 회원 탈퇴 — 백엔드 API 미정. 계정·데이터를 모두 삭제한다
  http.post('/api/users/withdraw', async () => {
    await delay(500);
    const authFail = requireAuth();
    if (authFail) return authFail;
    setAuthState({ loggedIn: false, nickname: null });
    setMockReports([]);
    setOpenApiRequests([]);
    return HttpResponse.json({ code: 200, message: '탈퇴가 완료되었습니다.', data: null });
  }),

  // 백엔드에 로그아웃 API가 아직 없음 — 확정 시 경로 맞출 것
  http.post('/api/auth/logout', async () => {
    await delay(300);
    setAuthState({ loggedIn: false, nickname: getAuthState().nickname });
    return HttpResponse.json(ok(null));
  }),

  // 실제 백엔드에는 없는 개발용 엔드포인트 — 카카오 OAuth 리다이렉트를 대신함
  http.post('/api/auth/mock-login', async () => {
    await delay(400);
    const state = getAuthState();
    setAuthState({ ...state, loggedIn: true });
    return HttpResponse.json(ok(null));
  }),

  http.post('/api/auth/sign-up', async ({ request }) => {
    await delay(400);
    const state = getAuthState();
    if (!state.loggedIn) return fail(401, '로그인이 필요합니다.');

    const body = (await request.json()) as { agrees?: string[][]; nickname?: string };
    const agreedCodes = new Set((body.agrees ?? []).map((pair) => pair[0]));
    const requiredOk = TERMS.filter((t) => t.required).every((t) => agreedCodes.has(t.code));
    if (!requiredOk) return fail(400, '필수 약관에 모두 동의하지 않았습니다.');

    const nickname = body.nickname ?? '';
    if (
      nickname.length < NICKNAME_MIN ||
      nickname.length > NICKNAME_MAX ||
      !NICKNAME_PATTERN.test(nickname)
    ) {
      return fail(400, '닉네임 형식이 올바르지 않습니다.');
    }

    setAuthState({ loggedIn: true, nickname });
    // 백엔드는 가입 완료 시 새 access token을 돌려준다 (권한 버전 갱신)
    return HttpResponse.json(
      ok({ accessToken: 'msw-access-token', tokenType: 'Bearer', expiresIn: 1800 }),
    );
  }),
];
