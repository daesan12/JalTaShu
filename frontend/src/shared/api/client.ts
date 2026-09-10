import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { ENV } from '@/shared/config/env';
import type { ApiResponse } from '@/shared/api/types';

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
  // 백엔드 인증이 세션 쿠키(JSESSIONID) 방식이라 모든 요청에 쿠키 포함 필수
  withCredentials: true,
});

function unwrap<T>(body: ApiResponse<T>): T {
  // 래퍼 형태가 아닌 응답(프록시 오설정 등)도 방어
  if (body?.code !== 200) {
    throw new ApiError(body?.code ?? 0, body?.message ?? '알 수 없는 응답입니다.');
  }
  return body.data as T;
}

function toApiError(err: unknown): ApiError {
  if (err instanceof AxiosError && err.response?.data) {
    const body = err.response.data as Partial<ApiResponse<unknown>>;
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

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await client.delete<ApiResponse<T>>(url, config);
    return unwrap(res.data);
  } catch (err) {
    throw err instanceof ApiError ? err : toApiError(err);
  }
}
