import { apiGet } from '@/shared/api/client';
import type { ReportTag } from '@/features/report/api/reports';

/** 자전거에 달린 제보(자전거 코드가 연결된 고장신고) — 18·20 화면 표시용 */
export interface BikeReport {
  tag: ReportTag;
  /** '기타' 태그의 직접 입력 부위명 */
  tagDetail: string | null;
  content: string;
  nickname: string;
  /** ISO 8601 */
  createdAt: string;
}

/** 18 자전거 상태 — 백엔드 API 미정, msw 목업 기준 임시 스키마 (확정 시 이 파일만 수정) */
export interface BikeStatus {
  /** QR에서 추출한 코드 — CSV 자전거번호(DJ-xxxx)와 다른 체계 */
  code: string;
  rideable: boolean;
  /** 최근 이용 시각 (ISO 8601) */
  lastUsedAt: string;
  /** 최근 반납 대여소 이름 */
  lastStationName: string;
  reports: BikeReport[];
}

export function getBikeStatus(code: string): Promise<BikeStatus> {
  return apiGet<BikeStatus>(`/bikes/${encodeURIComponent(code)}`);
}
