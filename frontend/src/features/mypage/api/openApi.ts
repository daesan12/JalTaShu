import { apiGet, apiPost } from '@/shared/api/client';

/** Open API 신청 — 백엔드 API 미정, msw 목업 기준 임시 스키마 */
export interface OpenApiRequest {
  id: number;
  purpose: string;
  reason: string;
  status: '접수됨' | '승인' | '반려';
  createdAt: string;
}

export const OPEN_API_PURPOSES = ['앱·웹 서비스 개발', '데이터 분석·연구', '학습·과제', '기타'];

export function submitOpenApiRequest(body: { purpose: string; reason: string }): Promise<null> {
  return apiPost<null>('/open-api/requests', body);
}

export function getOpenApiRequests(): Promise<OpenApiRequest[]> {
  return apiGet<OpenApiRequest[]>('/open-api/requests');
}
