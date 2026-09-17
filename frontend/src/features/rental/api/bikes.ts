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

/** 서버 enum(ClaimCategory 실측) → 화면 태그(한글) */
const CLAIM_CATEGORY_TO_TAG: Record<string, ReportTag> = {
  BREAK: '브레이크',
  TIRE: '타이어',
  SADDLE: '안장',
  CHAIN: '체인',
  FRAME: '프레임',
  ETC: '기타',
};

/** GET /cycle/list?cycleId= 한 건 (CycleClaimListResponse 실측) */
interface CycleClaimResponse {
  claimId: number;
  nickname: string;
  claimCategory: string;
  content: string;
  createdAt: string;
}

/**
 * 20 제보 리스트 — 백엔드 실구현. 응답의 카테고리 enum을 화면 태그로 바꿔
 * 기존 제보 카드(BikeReportCard)를 그대로 쓴다.
 */
export async function getCycleClaims(cycleId: string): Promise<BikeReport[]> {
  const claims = await apiGet<CycleClaimResponse[]>(
    `/cycle/list?cycleId=${encodeURIComponent(cycleId)}`,
  );
  return claims.map((claim) => ({
    tag: CLAIM_CATEGORY_TO_TAG[claim.claimCategory] ?? '기타',
    tagDetail: null,
    content: claim.content,
    nickname: claim.nickname,
    createdAt: claim.createdAt,
  }));
}
