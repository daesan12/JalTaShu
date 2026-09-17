import { HttpResponse } from 'msw';
import type { ApiResponse } from '@/shared/api/types';

/**
 * 목업 공통 재료 — 응답 래퍼와 이용자/관리자 가짜 세션.
 * 세션은 여러 도메인 핸들러가 함께 쓰는 유일한 상태라 여기 둔다.
 */

/** 백엔드 공통 래퍼와 동일한 형태로 감싸기 */
export function ok<T>(data: T): ApiResponse<T> {
  return { code: 200, message: 'OK', data };
}

export function fail(code: number, message: string) {
  return HttpResponse.json({ code, message, data: null }, { status: code });
}

/** 백엔드는 모든 API가 세션 필수(.anyRequest().authenticated()) — 동일하게 흉내 */
export function requireAuth() {
  return getAuthState().loggedIn ? null : fail(401, '로그인이 필요합니다.');
}

/** 가짜 로그인 세션 — 새로고침에도 유지되도록 localStorage 사용 (개발 초기화: 브라우저 저장소 삭제) */
const AUTH_STATE_KEY = 'msw_auth_state';

export interface MockAuthState {
  loggedIn: boolean;
  nickname: string | null;
}

export function getAuthState(): MockAuthState {
  try {
    const raw = localStorage.getItem(AUTH_STATE_KEY);
    if (raw) return JSON.parse(raw) as MockAuthState;
  } catch {
    // 파싱 실패 시 초기 상태
  }
  return { loggedIn: false, nickname: null };
}

export function setAuthState(state: MockAuthState) {
  try {
    localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(state));
  } catch {
    // 저장 불가 환경 무시
  }
}

/*
 * 가짜 관리자 세션 — 이용자 세션과 완전히 별개다.
 * 백엔드에 관리자 로그인 API가 아직 없어 임시로 둔다. 확정되면 이 블록과 adminAuth 핸들러 3개를 지운다.
 */
const ADMIN_AUTH_KEY = 'msw_admin_auth';

/** Figma 로그인 화면에 적힌 아이디가 admin이라 그대로 쓴다 */
export const MOCK_ADMIN = {
  adminId: 1,
  id: 'admin',
  password: 'admin1234',
  name: '운영관리자',
  email: 'admin@tashu.kr',
};

export function isAdminLoggedIn(): boolean {
  try {
    return localStorage.getItem(ADMIN_AUTH_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAdminLoggedIn(value: boolean) {
  try {
    localStorage.setItem(ADMIN_AUTH_KEY, String(value));
  } catch {
    // 저장 불가 환경 무시
  }
}
