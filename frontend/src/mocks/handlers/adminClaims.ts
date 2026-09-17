import { delay, http, HttpResponse } from 'msw';
import { fail, isAdminLoggedIn, ok } from '@/mocks/core';

/** 관리자 제보(claim) 저장소 — 백엔드 AdminCycleController 실스키마 기준 목업 CRUD */
const ADMIN_CLAIMS_KEY = 'msw_admin_claims';

export type MockClaimStatus = 'READY' | 'IN_PROGRESS' | 'COMPLETED';
export type MockClaimCategory = 'BREAK' | 'TIRE' | 'SADDLE' | 'CHAIN' | 'FRAME' | 'ETC';

/** 목록·상세 응답을 모두 만들 수 있게 상세 전용 필드까지 한 저장소에 둔다 */
export interface MockClaim {
  claimId: number;
  cycleId: string;
  recordId: number;
  content: string;
  category: MockClaimCategory;
  nickname: string;
  userId: number;
  createdAt: string;
  cycleReportNum: number;
  status: MockClaimStatus;
  adminComment: string | null;
  photoUrl: string | null;
  rentalAt: string;
  returnAt: string;
}

const CLAIM_SEEDS: { category: MockClaimCategory; content: string }[] = [
  { category: 'BREAK', content: '브레이크가 잘 안 잡혀요. 내리막에서 위험합니다.' },
  { category: 'TIRE', content: '앞바퀴 공기압이 거의 없어요.' },
  { category: 'CHAIN', content: '체인이 자꾸 빠집니다. 두 번이나 다시 끼웠어요.' },
  { category: 'SADDLE', content: '안장 높이 조절 레버가 고장났어요.' },
  { category: 'FRAME', content: '프레임에 금이 간 것 같아요. 확인 부탁드립니다.' },
  { category: 'ETC', content: '반납했는데 앱에서 계속 대여 중으로 나와요.' },
  { category: 'ETC', content: 'QR 코드 스티커가 훼손돼서 스캔이 안 됩니다.' },
];
const CLAIM_NICKNAMES = ['달리는거북', '바퀴요정', '자전거덕후', '탄방동주민', '출근라이더'];

function seedClaims(): MockClaim[] {
  const statuses: MockClaimStatus[] = [
    'READY', 'READY', 'IN_PROGRESS', 'READY', 'COMPLETED', 'READY', 'IN_PROGRESS', 'COMPLETED',
  ];
  return Array.from({ length: 26 }, (_, i) => {
    const seed = CLAIM_SEEDS[i % CLAIM_SEEDS.length];
    const status = statuses[i % statuses.length];
    // 최신 제보가 위로 오게 약 하루 간격으로 과거로 펼친다
    const createdAt = Date.now() - (i * 26 + 3) * 3600_000;
    return {
      claimId: 26 - i,
      cycleId: `DJ-1${String((i * 7) % 90).padStart(4, '0')}`,
      recordId: 5000 + i,
      content: seed.content,
      category: seed.category,
      nickname: CLAIM_NICKNAMES[i % CLAIM_NICKNAMES.length],
      userId: (i % 30) + 1,
      createdAt: new Date(createdAt).toISOString(),
      cycleReportNum: (i * 3) % 6,
      status,
      adminComment: status === 'COMPLETED' ? '점검 완료 후 재배치했습니다.' : null,
      photoUrl: null,
      // 제보는 이용 기록에 달리므로 그 직전 이용 시각을 함께 만들어 둔다
      rentalAt: new Date(createdAt - 40 * 60_000).toISOString(),
      returnAt: new Date(createdAt - 5 * 60_000).toISOString(),
    };
  });
}

/** 자전거 상세(adminCycles)의 제보 탭도 이 저장소를 읽는다 */
export function getMockClaims(): MockClaim[] {
  try {
    const raw = localStorage.getItem(ADMIN_CLAIMS_KEY);
    if (raw) return JSON.parse(raw) as MockClaim[];
  } catch {
    // 파싱 실패 시 시드로 초기화
  }
  const seeded = seedClaims();
  setMockClaims(seeded);
  return seeded;
}

function setMockClaims(claims: MockClaim[]) {
  try {
    localStorage.setItem(ADMIN_CLAIMS_KEY, JSON.stringify(claims));
  } catch {
    // 저장 불가 환경 무시
  }
}

/** 목록 응답 — 상세 전용 필드(처리 내용·사진·이용 시각)는 hasComment로 요약된다. adminCycles도 쓴다 */
export function toListItem(claim: MockClaim) {
  const { adminComment, photoUrl: _photoUrl, rentalAt: _rentalAt, returnAt: _returnAt, ...rest } =
    claim;
  return { ...rest, hasComment: adminComment !== null };
}

/**
 * 관리자 제보 관리 (03 — AdminCycleController 실측 스키마).
 * ⚠ 고정 경로(cycle/claim, cycle/claim/:claimId)는 adminCycles의 :cycleId 핸들러보다
 * 먼저 등록해야 한다 (배럴에서 adminClaimHandlers가 adminCycleHandlers 앞).
 */
export const adminClaimHandlers = [
  http.get('/api/admin/cycle/claim', async () => {
    await delay(350);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const claims = [...getMockClaims()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toListItem);
    return HttpResponse.json(ok(claims));
  }),

  http.get('/api/admin/cycle/claim/:claimId', async ({ params }) => {
    await delay(300);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const claim = getMockClaims().find((c) => c.claimId === Number(params.claimId));
    if (!claim) return fail(404, '존재하지 않는 제보입니다.');
    return HttpResponse.json(
      ok({
        claimId: claim.claimId,
        cycleId: claim.cycleId,
        userId: claim.userId,
        nickname: claim.nickname,
        createdAt: claim.createdAt,
        recordId: claim.recordId,
        rentalAt: claim.rentalAt,
        returnAt: claim.returnAt,
        content: claim.content,
        statement: claim.status,
        adminComment: claim.adminComment,
        photoUrl: claim.photoUrl,
        report: [],
      }),
    );
  }),

  http.patch('/api/admin/cycle/claim/:claimId', async ({ params, request }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const body = (await request.json()) as { statement?: MockClaimStatus; content?: string };
    if (!body.statement) return fail(400, '변경할 상태를 선택해 주세요.');
    if ((body.content ?? '').length > 255) return fail(400, '처리 내용은 255자 이내여야 합니다.');
    const claims = getMockClaims();
    const claim = claims.find((c) => c.claimId === Number(params.claimId));
    if (!claim) return fail(404, '존재하지 않는 제보입니다.');
    claim.status = body.statement;
    claim.adminComment = body.content?.trim() || null;
    setMockClaims(claims);
    // 백엔드 AdminCycleClaimUpdateResponse — claimId만 돌려준다
    return HttpResponse.json(ok({ claimId: claim.claimId }));
  }),
];
