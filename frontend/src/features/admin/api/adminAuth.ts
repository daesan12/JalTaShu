import { apiGet, apiPost } from '@/shared/api/client';

export interface AdminMe {
  adminId: number;
  /** 로그인 아이디 (Figma 로그인 화면의 "admin") */
  id: string;
}

/**
 * GET /api/admin/auth/me — 미로그인 시 401.
 * 로그인 여부를 '확인'하는 요청이라 전역 리다이렉트에서 제외한다.
 *
 * ⚠ 백엔드에 아직 없는 API다. AdminEntity(id·password)와 @currentAdminId는 있으나
 *   로그인 엔드포인트가 없어 기존 사용자 인증과 같은 httpOnly 쿠키 방식을 전제로
 *   msw 목업 기준 임시 스키마를 쓴다. 확정되면 목업만 걷어내면 된다.
 */
export function getAdminMe(): Promise<AdminMe> {
  return apiGet<AdminMe>('/admin/auth/me', { skipAuthRedirect: true });
}

/**
 * POST /api/admin/auth/login — 성공하면 httpOnly 쿠키가 내려온다.
 * 실패(401)도 정상 흐름이라 전역 리다이렉트에서 제외한다. 안 그러면 로그인 화면이 자기 자신으로 튕긴다.
 */
export function adminLogin(id: string, password: string): Promise<null> {
  return apiPost<null>('/admin/auth/login', { id, password }, { skipAuthRedirect: true });
}
