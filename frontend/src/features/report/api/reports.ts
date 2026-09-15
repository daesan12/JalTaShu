import { apiGet, apiPost } from '@/shared/api/client';

/** 민원 유형 — 17-1 고장 / 17-2 방치 / 17-3 기타문의 */
export type ReportType = 'broken' | 'abandoned' | 'inquiry';

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  broken: '고장신고',
  abandoned: '방치신고',
  inquiry: '기타문의',
};

/** 고장 부위 태그 — 자전거 다이어그램 하이라이트·배지에 사용 (반납 오류·기타는 부위 아님) */
export const REPORT_TAGS = [
  '반납 오류',
  '브레이크',
  '타이어',
  '안장',
  '체인',
  '프레임',
  '기타',
] as const;
export type ReportTag = (typeof REPORT_TAGS)[number];

/** 백엔드 API 미정 — msw 목업 기준 임시 스키마 (확정 시 이 파일만 수정) */
export interface ReportSubmission {
  type: ReportType;
  bikeCode: string | null;
  /** 고장신고 전용 부위 태그 */
  tag: ReportTag | null;
  /** 태그가 '기타'일 때 직접 입력한 문제 부위 */
  tagDetail: string | null;
  content: string;
  /** 사진은 업로드 API 확정 전이라 파일명만 전달 */
  photoName: string | null;
}

export interface MyReport {
  id: number;
  type: ReportType;
  bikeCode: string | null;
  tag: ReportTag | null;
  tagDetail: string | null;
  content: string;
  status: '접수됨' | '처리중' | '완료';
  createdAt: string;
}

export function submitReport(body: ReportSubmission): Promise<null> {
  return apiPost<null>('/reports', body);
}

export function getMyReports(): Promise<MyReport[]> {
  return apiGet<MyReport[]>('/reports/my');
}
