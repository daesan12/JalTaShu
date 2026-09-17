import { delay, http, HttpResponse } from 'msw';
import { fail, MOCK_ADMIN, ok, setAdminLoggedIn, isAdminLoggedIn } from '@/mocks/core';

/** 관리자 로그인 (10) — 백엔드에 아직 없는 API라 계정·세션 전부 목업 */
export const adminAuthHandlers = [
  http.post('/api/admin/auth/login', async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as { id?: string; password?: string };
    if (body.id !== MOCK_ADMIN.id || body.password !== MOCK_ADMIN.password) {
      return fail(401, '아이디 또는 비밀번호가 올바르지 않습니다.');
    }
    setAdminLoggedIn(true);
    return HttpResponse.json(ok(null));
  }),

  http.get('/api/admin/auth/me', async () => {
    await delay(200);
    if (!isAdminLoggedIn()) return fail(401, '로그인이 필요합니다.');
    const { password: _password, ...me } = MOCK_ADMIN;
    return HttpResponse.json(ok(me));
  }),

  http.post('/api/admin/auth/logout', async () => {
    await delay(200);
    setAdminLoggedIn(false);
    return HttpResponse.json(ok(null));
  }),
];
