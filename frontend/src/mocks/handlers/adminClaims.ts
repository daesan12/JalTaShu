import { delay, http, HttpResponse } from 'msw';
import { fail, isAdminLoggedIn, ok } from '@/mocks/core';

/** 관리자 제보(claim) 저장소 — API 3종 전부 백엔드 미구현이라 목업으로 CRUD한다 */
const ADMIN_CLAIMS_KEY = 'msw_admin_claims';

export type MockClaimStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export interface MockClaim {
  claimId: number;
  cycleId: string;
  nickname: string;
  tag: string;
  content: string;
  statement: MockClaimStatus;
  adminContent: string | null;
  reportCnt: number;
  createdAt: string;
}

const CLAIM_SEEDS: { tag: string; content: string }[] = [
  { tag: '브레이크', content: '브레이크가 잘 안 잡혀요. 내리막에서 위험합니다.' },
  { tag: '타이어', content: '앞바퀴 공기압이 거의 없어요.' },
  { tag: '체인', content: '체인이 자꾸 빠집니다. 두 번이나 다시 끼웠어요.' },
  { tag: '안장', content: '안장 높이 조절 레버가 고장났어요.' },
  { tag: '프레임', content: '프레임에 금이 간 것 같아요. 확인 부탁드립니다.' },
  { tag: '반납 오류', content: '반납했는데 앱에서 계속 대여 중으로 나와요.' },
  { tag: '기타', content: 'QR 코드 스티커가 훼손돼서 스캔이 안 됩니다.' },
];
const CLAIM_NICKNAMES = ['달리는거북', '바퀴요정', '자전거덕후', '탄방동주민', '출근라이더'];

function seedClaims(): MockClaim[] {
  const statuses: MockClaimStatus[] = [
    'OPEN', 'OPEN', 'IN_PROGRESS', 'OPEN', 'RESOLVED', 'OPEN', 'IN_PROGRESS', 'RESOLVED',
  ];
  return Array.from({ length: 26 }, (_, i) => {
    const seed = CLAIM_SEEDS[i % CLAIM_SEEDS.length];
    const statement = statuses[i % statuses.length];
    return {
      claimId: 26 - i,
      cycleId: `DJ-1${String((i * 7) % 90).padStart(4, '0')}`,
      nickname: CLAIM_NICKNAMES[i % CLAIM_NICKNAMES.length],
      tag: seed.tag,
      content: seed.content,
      statement,
      adminContent: statement === 'RESOLVED' ? '점검 완료 후 재배치했습니다.' : null,
      reportCnt: (i * 3) % 6,
      // 최신 제보가 위로 오게 약 하루 간격으로 과거로 펼친다
      createdAt: new Date(Date.now() - (i * 26 + 3) * 3600_000).toISOString(),
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

/**
 * 관리자 제보 관리 (03 — API 전부 미구현, 목업 기준).
 * ⚠ GET /api/admin/cycle/claim은 adminCycles의 :cycleId 핸들러보다 먼저 등록해야 한다
 * (배럴에서 adminClaimHandlers를 adminCycleHandlers 앞에 둔다).
 */
export const adminClaimHandlers = [
  http.get('/api/admin/cycle/claim', async () => {
    await delay(350);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const claims = [...getMockClaims()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(ok(claims));
  }),

  http.patch('/api/admin/cycle/claim/:claimId', async ({ params, request }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const body = (await request.json()) as { statement?: MockClaimStatus; content?: string };
    if (!body.statement) return fail(400, '변경할 상태를 선택해 주세요.');
    const claims = getMockClaims();
    const claim = claims.find((c) => c.claimId === Number(params.claimId));
    if (!claim) return fail(404, '존재하지 않는 제보입니다.');
    claim.statement = body.statement;
    claim.adminContent = body.content?.trim() || null;
    setMockClaims(claims);
    return HttpResponse.json(ok(claim));
  }),
];
