import { apiGet, apiPost } from '@/shared/api/client';

/** 민원 유형 — 17-1 고장 / 17-2 방치 / 17-3 기타문의 */
export type ReportType = 'broken' | 'abandoned' | 'inquiry';

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  broken: '고장신고',
  abandoned: '방치신고',
  inquiry: '기타문의',
};

/** 백엔드 ClaimType ↔ 화면 유형 */
export type ClaimType = 'CYCLE' | 'ABANDONED' | 'ETC';

const CLAIM_TYPE_TO_REPORT: Record<ClaimType, ReportType> = {
  CYCLE: 'broken',
  ABANDONED: 'abandoned',
  ETC: 'inquiry',
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

/** 상세내용 최대 길이 — 백엔드 CycleClaimRequest의 @Length(max = 500)에 맞춘 값 */
export const REPORT_CONTENT_MAX = 500;

/** 백엔드 ClaimCategory — 고장 부위 */
export type ClaimCategory = 'BREAK' | 'TIRE' | 'SADDLE' | 'CHAIN' | 'FRAME' | 'ETC';

export const CLAIM_CATEGORY_TO_TAG: Record<ClaimCategory, ReportTag> = {
  BREAK: '브레이크',
  TIRE: '타이어',
  SADDLE: '안장',
  CHAIN: '체인',
  FRAME: '프레임',
  ETC: '기타',
};

/**
 * 부위 태그 → 백엔드 enum.
 * '반납 오류'는 대응하는 enum이 없어 ETC로 보낸다(백엔드에 RETURN_ERROR 추가 요청 중).
 */
const TAG_TO_CLAIM_CATEGORY: Record<ReportTag, ClaimCategory> = {
  '반납 오류': 'ETC',
  브레이크: 'BREAK',
  타이어: 'TIRE',
  안장: 'SADDLE',
  체인: 'CHAIN',
  프레임: 'FRAME',
  기타: 'ETC',
};

/**
 * enum으로 옮기지 못한 부위를 내용 앞에 말머리로 남긴다.
 *
 * '반납 오류'는 보낼 enum이 없고, '기타'로 직접 입력한 부위(`tagDetail`)는 담을 필드가 없다.
 * 그대로 두면 사용자가 고른·적은 정보가 접수 순간 사라지므로, 관리자가 볼 수 있게 내용에 붙인다.
 * 백엔드에 RETURN_ERROR와 부위 직접입력 필드가 생기면 이 처리는 걷어낸다.
 */
export function buildClaimContent(
  tag: ReportTag | null,
  tagDetail: string | null,
  content: string,
): string {
  const body = content.trim();
  if (tag === '반납 오류') return `[반납 오류] ${body}`;
  const detail = tagDetail?.trim();
  if (tag === '기타' && detail) return `[${detail}] ${body}`;
  return body;
}

export interface ReportSubmission {
  type: ReportType;
  /** 고장·방치 신고에 필요한 자전거 코드 (기타문의는 쓰지 않는다) */
  bikeCode: string;
  /** 고장신고 전용 부위 태그 */
  tag: ReportTag | null;
  /** 태그가 '기타'일 때 직접 입력한 문제 부위 */
  tagDetail: string | null;
  content: string;
  photo: File | null;
}

/**
 * 민원 접수 — 유형마다 엔드포인트가 다르다.
 * - 고장   POST /claim/cycle      (multipart: cycleId·claimCategory·content·file)
 * - 방치   POST /claim/abandoned  (multipart: cycleId·content·file)
 * - 기타   POST /claim/etc        (JSON: content)
 */
export function submitReport(body: ReportSubmission): Promise<{ claimId: number }> {
  const content = buildClaimContent(body.tag, body.tagDetail, body.content);

  if (body.type === 'inquiry') {
    return apiPost<{ claimId: number }>('/claim/etc', { content });
  }

  const form = new FormData();
  form.append('cycleId', body.bikeCode);
  form.append('content', content);
  if (body.photo) form.append('file', body.photo);

  if (body.type === 'broken') {
    form.append('claimCategory', TAG_TO_CLAIM_CATEGORY[body.tag ?? '기타']);
    return apiPost<{ claimId: number }>('/claim/cycle', form);
  }
  return apiPost<{ claimId: number }>('/claim/abandoned', form);
}

/** 내 민원 한 건 — 백엔드 ClaimListResponse 실측 (처리 상태·자전거 코드는 응답에 없다) */
export interface MyClaim {
  claimId: number;
  claimType: ClaimType;
  /** 고장(CYCLE)에만 있다 */
  claimCategory: ClaimCategory | null;
  content: string;
  createdAt: string;
}

/** 17-4 내 민원 내역 — 백엔드 `GET /claim/list/me` (고장·방치·기타가 모두 온다) */
export function getMyClaims(): Promise<MyClaim[]> {
  return apiGet<MyClaim[]>('/claim/list/me');
}

/** 목록 한 줄의 유형 이름 */
export function toReportTypeLabel(claimType: ClaimType): string {
  return REPORT_TYPE_LABEL[CLAIM_TYPE_TO_REPORT[claimType]];
}
