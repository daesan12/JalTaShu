import { apiPost, refreshAccessToken, setAccessToken } from '@/shared/api/client';

/**
 * 관리자 인증 — 백엔드 실구현(AdminController) 기준.
 * 이용자와 같은 JWT Bearer 방식이지만 **토큰 체계가 별개다**: access token은 client.ts의
 * 메모리 슬롯을 같이 쓰고(한 화면에서는 한 세션만 활동), refresh token은
 * httpOnly 쿠키 `admin_refresh_token`(경로 /api/admin)으로 따로 내려온다.
 */

interface AdminTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

/**
 * POST /api/admin/login — 성공하면 access token(메모리)과 refresh 쿠키를 받는다.
 * 실패(401)도 정상 흐름이라 전역 리다이렉트·재발급에서 제외한다.
 */
export async function adminLogin(id: string, password: string): Promise<void> {
  const res = await apiPost<AdminTokenResponse>(
    '/admin/login',
    { id, password },
    { skipAuthRedirect: true, skipAuthRefresh: true },
  );
  setAccessToken(res.accessToken);
}

/**
 * 새로고침 뒤 세션 복구 — 백엔드에 관리자 me API가 없어서(백엔드 전달 목록),
 * refresh 쿠키로 access token 재발급이 되는지가 곧 "로그인돼 있는지"다.
 * 실패해도 예외를 던지지 않는다(미로그인은 정상 상태).
 */
export async function restoreAdminSession(): Promise<boolean> {
  // 401 인터셉터와 같은 재발급 락을 탄다 — 같은 쿠키로 두 번 치면 서버가 재사용으로 보고 세션을 폐기한다
  return (await refreshAccessToken()) !== null;
}

/** POST /api/admin/logout — 서버가 refresh를 폐기하고 쿠키를 만료시킨다. 메모리 토큰도 지운다 */
export async function adminLogout(): Promise<void> {
  try {
    await apiPost<null>('/admin/logout', undefined, { skipAuthRedirect: true });
  } finally {
    setAccessToken(null);
  }
}
