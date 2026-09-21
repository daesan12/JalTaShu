import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { ENV } from '@/shared/config/env';
import type { ApiResponse } from '@/shared/api/types';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** 401이어도 로그인 화면으로 보내지 않는다 (예: 로그인 여부 확인용 /users/me) */
    skipAuthRedirect?: boolean;
    /** 401이어도 토큰 재발급을 시도하지 않는다 (재발급 요청 자신) */
    skipAuthRefresh?: boolean;
    /** 재발급 뒤 한 번 다시 보낸 요청인지 — 무한 재시도 방지용(내부 전용) */
    authRetried?: boolean;
  }
}

/** 백엔드 에러를 화면에서 그대로 쓸 수 있게 정규화한 에러 */
export class ApiError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export const client = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 10_000,
  // refresh token이 httpOnly 쿠키라 재발급 요청에 쿠키가 실려야 한다
  withCredentials: true,
});

/*
 * 인증 — 백엔드는 **JWT Bearer 토큰** 방식이다(세션 쿠키가 아니다).
 *
 * - access token은 쿠키가 아니라서 브라우저가 자동으로 안 붙인다 → 요청마다 헤더에 직접 적는다
 * - 저장은 **메모리에만** 한다. localStorage는 XSS에 취약하고, 새로고침하면 아래 재발급으로 다시 받는다
 * - refresh token은 httpOnly 쿠키(경로 `/api/auth`)라 재발급 요청에만 자동으로 실린다
 * - 로그인 직후에도 백엔드가 access token을 본문으로 주지 않는다(쿠키만 심고 리다이렉트).
 *   그래서 첫 요청이 401을 받고 → 재발급 → 재시도하는 이 흐름이 로그인 복구 경로이기도 하다
 */
let accessToken: string | null = null;

/** 로그인·재발급에 성공한 쪽이 토큰을 넣어 준다. 로그아웃은 null */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

client.interceptors.request.use((config) => {
  if (accessToken !== null) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

/**
 * 재발급은 동시에 한 번만 — 화면 여러 곳이 한꺼번에 401을 받아도 요청이 몰리지 않게 한다.
 * 실패해도 예외를 던지지 않고 null을 돌려준다(호출한 쪽이 "세션 만료"로 처리한다).
 */
let refreshing: Promise<string | null> | null = null;

/**
 * 관리자 웹은 별도 토큰 체계다 — refresh 쿠키 이름(admin_refresh_token)과 재발급 경로가 다르다.
 * 어느 쪽 재발급을 칠지는 로그인 리다이렉트와 같은 기준(현재 화면이 /admin인지)으로 정한다.
 */
function refreshTokenUrl(): string {
  const base = import.meta.env.BASE_URL;
  return window.location.pathname.startsWith(`${base}admin`)
    ? '/admin/token/refresh'
    : '/auth/token/refresh';
}

function refreshAccessToken(): Promise<string | null> {
  refreshing ??= client
    .post<ApiResponse<TokenResponse>>(refreshTokenUrl(), null, {
      skipAuthRedirect: true,
      skipAuthRefresh: true,
    })
    .then((res) => {
      accessToken = res.data?.data?.accessToken ?? null;
      return accessToken;
    })
    .catch(() => {
      accessToken = null;
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** 세션이 끝났을 때 로그인 화면으로 (새로고침 효과로 상태도 초기화) */
function redirectToLogin(): void {
  // 관리자 화면에서 끊겼으면 모바일 로그인이 아니라 관리자 로그인으로 보낸다
  const base = import.meta.env.BASE_URL;
  const inAdmin = window.location.pathname.startsWith(`${base}admin`);
  const loginUrl = `${base}${inAdmin ? 'admin/login' : 'login'}`;
  // 이미 로그인 화면이면 리다이렉트 루프 방지
  if (window.location.pathname !== loginUrl) {
    window.location.assign(loginUrl);
  }
}

/** 401 → 재발급 1회 → 원래 요청 재시도. 그래도 안 되면 로그인 화면 */
client.interceptors.response.use(undefined, async (error: unknown) => {
  if (!(error instanceof AxiosError) || error.response?.status !== 401 || !error.config) {
    return Promise.reject(error);
  }
  const config = error.config;
  if (!config.skipAuthRefresh && !config.authRetried) {
    const token = await refreshAccessToken();
    if (token !== null) {
      config.authRetried = true;
      return client.request(config);
    }
  }
  accessToken = null;
  if (!config.skipAuthRedirect) redirectToLogin();
  return Promise.reject(error);
});

function unwrap<T>(body: ApiResponse<T>): T {
  // 래퍼 형태가 아닌 응답(프록시 오설정 등)도 방어
  if (body?.code !== 200) {
    throw new ApiError(body?.code ?? 0, body?.message ?? '알 수 없는 응답입니다.');
  }
  return body.data as T;
}

function toApiError(err: unknown): ApiError {
  if (err instanceof AxiosError && err.response) {
    // 시큐리티 필터가 자른 401·403은 본문이 비어 있다 — 그 경우 HTTP 상태 코드를 쓴다
    const body = (err.response.data || {}) as Partial<ApiResponse<unknown>>;
    return new ApiError(body.code ?? err.response.status, body.message ?? '요청에 실패했습니다.');
  }
  return new ApiError(0, '네트워크 연결을 확인해 주세요.');
}

/** GET — ApiResponse 래퍼를 벗겨 data만 돌려준다 */
export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await client.get<ApiResponse<T>>(url, config);
    return unwrap(res.data);
  } catch (err) {
    throw err instanceof ApiError ? err : toApiError(err);
  }
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  try {
    const res = await client.post<ApiResponse<T>>(url, body, config);
    return unwrap(res.data);
  } catch (err) {
    throw err instanceof ApiError ? err : toApiError(err);
  }
}

export async function apiPut<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  try {
    const res = await client.put<ApiResponse<T>>(url, body, config);
    return unwrap(res.data);
  } catch (err) {
    throw err instanceof ApiError ? err : toApiError(err);
  }
}

export async function apiPatch<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  try {
    const res = await client.patch<ApiResponse<T>>(url, body, config);
    return unwrap(res.data);
  } catch (err) {
    throw err instanceof ApiError ? err : toApiError(err);
  }
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await client.delete<ApiResponse<T>>(url, config);
    return unwrap(res.data);
  } catch (err) {
    throw err instanceof ApiError ? err : toApiError(err);
  }
}
