import { apiGet } from '@/shared/api/client';

/** 공지사항 — 백엔드 API 미정, msw 목업 기준 임시 스키마 */
export interface Notice {
  id: number;
  title: string;
  /** YYYY/MM/DD */
  date: string;
}

export function getNotices(): Promise<Notice[]> {
  return apiGet<Notice[]>('/notices');
}
