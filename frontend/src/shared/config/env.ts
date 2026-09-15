/** import.meta.env 직접 접근 금지 — 반드시 이 래퍼를 통해 사용 */
export const ENV = {
  API_BASE_URL: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api',
  /** 백엔드 OAuth 시작 경로 (API와 별개 — 백엔드의 /auth/** 를 가리켜야 함) */
  AUTH_BASE_URL: (import.meta.env.VITE_AUTH_BASE_URL as string | undefined) ?? '/auth',
  NAVER_MAP_CLIENT_ID: (import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined) ?? '',
  ENABLE_MSW: import.meta.env.VITE_ENABLE_MSW === 'true',
} as const;
