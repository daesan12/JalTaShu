import { delay, http, HttpResponse } from 'msw';
import { fail, isAdminLoggedIn, MOCK_ADMIN, ok, setAdminLoggedIn } from '@/mocks/core';

/** 백엔드 TokenResponseDto와 같은 모양의 가짜 토큰 */
const MOCK_ADMIN_TOKEN = {
  accessToken: 'msw-admin-access-token',
  tokenType: 'Bearer',
  expiresIn: 1800,
};

/**
 * 관리자 인증 (AdminController 실측 스키마) — 실서버는 httpOnly `admin_refresh_token`
 * 쿠키를 쓰지만 목업은 쿠키가 없으므로 localStorage 플래그(core)로 세션을 흉내 낸다.
 */
export const adminAuthHandlers = [
  http.post('/api/admin/login', async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as { id?: string; password?: string };
    if (body.id !== MOCK_ADMIN.id || body.password !== MOCK_ADMIN.password) {
      return fail(401, '아이디 또는 비밀번호가 올바르지 않습니다.');
    }
    setAdminLoggedIn(true);
    return HttpResponse.json(ok(MOCK_ADMIN_TOKEN));
  }),

  // 세션 복구 — 프론트는 이 요청의 성공 여부로 로그인 상태를 판정한다
  http.post('/api/admin/token/refresh', async () => {
    await delay(200);
    if (!isAdminLoggedIn()) return fail(401, '로그인이 필요합니다.');
    return HttpResponse.json(ok(MOCK_ADMIN_TOKEN));
  }),

  http.post('/api/admin/logout', async () => {
    await delay(200);
    setAdminLoggedIn(false);
    return HttpResponse.json(ok(null));
  }),
];
