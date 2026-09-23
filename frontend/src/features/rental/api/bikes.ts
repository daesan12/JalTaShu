import { apiGet, apiPost } from '@/shared/api/client';
import type { ReportTag } from '@/features/report/api/reports';

/** 민원 유형 — 백엔드 ClaimType 실측 (고장 / 방치 / 기타 문의) */
export type ClaimType = 'CYCLE' | 'ABANDONED' | 'ETC';

/** 자전거에 달린 제보 — 18·20 화면 표시용 */
export interface BikeReport {
  /** 허위 제보 신고(POST /claim/{claimId}/report)에 쓰는 제보 id */
  claimId: number;
  claimType: ClaimType;
  /** 배지에 그대로 찍는 표시용 문구 — 고장은 부위, 그 외는 유형 이름 */
  tag: string;
  /** '기타' 태그의 직접 입력 부위명 */
  tagDetail: string | null;
  content: string;
  nickname: string;
  /** ISO 8601 */
  createdAt: string;
}

/** 허위 제보 신고 사유 — 백엔드 ClaimReportCategory 실측 */
export type ClaimReportCategory = 'FALSE_INFORMATION' | 'PRANK_REPORT' | 'ABUSE' | 'ETC';

/** 신고 사유 선택지 — 표시 순서가 곧 화면 순서다 */
export const CLAIM_REPORT_CATEGORIES: { value: ClaimReportCategory; label: string }[] = [
  { value: 'FALSE_INFORMATION', label: '허위 정보' },
  { value: 'PRANK_REPORT', label: '장난성 제보' },
  { value: 'ABUSE', label: '욕설·비방' },
  { value: 'ETC', label: '기타' },
];

/**
 * 18 자전거 상태 — 한 화면에 쓰는 값이지만 서버는 두 곳에서 온다.
 * 상태·최근 이용은 `GET /cycle/statement/{cycleId}`, 제보 목록은 `GET /claim/list?cycleId=`.
 * 이용 이력이 없거나 대여소를 모르는 자전거는 시각·대여소가 null로 온다(화면에서 "없음" 표기).
 */
export interface BikeStatus {
  /** QR에서 추출한 코드 — CSV 자전거번호(DJ-xxxx)와 다른 체계 */
  code: string;
  rideable: boolean;
  /** 최근 이용 시각 (ISO 8601) */
  lastUsedAt: string | null;
  /** 최근 반납 대여소 이름 */
  lastStationName: string | null;
  reports: BikeReport[];
}

interface CycleStatementResponse {
  cycleId: string;
  rideable: boolean;
  lastUsedAt: string | null;
  lastStationName: string | null;
}

export async function getBikeStatus(code: string): Promise<BikeStatus> {
  const [statement, reports] = await Promise.all([
    apiGet<CycleStatementResponse>(`/cycle/statement/${encodeURIComponent(code)}`),
    getCycleClaims(code),
  ]);
  return {
    code: statement.cycleId,
    rideable: statement.rideable,
    lastUsedAt: statement.lastUsedAt,
    lastStationName: statement.lastStationName,
    reports,
  };
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

/** GET /claim/list?cycleId= 한 건 (ClaimListResponse 실측) */
interface CycleClaimResponse {
  claimId: number;
  claimType: ClaimType;
  nickname: string;
  /** 고장(CYCLE)에만 있다 — 방치·기타는 부위가 없어 null */
  claimCategory: string | null;
  content: string;
  createdAt: string;
}

/** 유형별 배지 문구 — 고장은 부위를, 나머지는 유형 이름을 쓴다 */
function toDisplayTag(claim: CycleClaimResponse): string {
  if (claim.claimType === 'ABANDONED') return '방치 신고';
  if (claim.claimType === 'ETC') return '기타 문의';
  return (claim.claimCategory && CLAIM_CATEGORY_TO_TAG[claim.claimCategory]) ?? '기타';
}

/**
 * 20 제보 리스트 — 백엔드 `GET /claim/list?cycleId=`.
 * 이 자전거에 달린 고장·방치 민원이 함께 온다. 응답 enum을 화면 배지 문구로 바꿔
 * 기존 제보 카드(BikeReportCard)를 그대로 쓴다.
 */
export async function getCycleClaims(cycleId: string): Promise<BikeReport[]> {
  const claims = await apiGet<CycleClaimResponse[]>(
    `/claim/list?cycleId=${encodeURIComponent(cycleId)}`,
  );
  return claims.map((claim) => ({
    claimId: claim.claimId,
    claimType: claim.claimType,
    tag: toDisplayTag(claim),
    tagDetail: null,
    content: claim.content,
    nickname: claim.nickname,
    createdAt: claim.createdAt,
  }));
}

/**
 * 20·18 "신고" — 남이 올린 제보가 잘못됐을 때 사유를 붙여 신고한다.
 * 백엔드는 접수만 하고 중복·횟수 제한을 두지 않는다(2026-09-18 확인) — 화면 쪽 가드는
 * `lib/claimReportLimit`이 맡는다.
 */
export function reportCycleClaim(
  claimId: number,
  claimCategory: ClaimReportCategory,
): Promise<null> {
  return apiPost<null>(`/claim/${claimId}/report`, { claimCategory });
}
