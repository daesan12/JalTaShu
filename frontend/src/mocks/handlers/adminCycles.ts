import { delay, http, HttpResponse } from 'msw';
import { fail, isAdminLoggedIn, ok } from '@/mocks/core';
import { getMockClaims, toListItem } from '@/mocks/handlers/adminClaims';
import { mockUserNickname } from '@/mocks/handlers/adminUsers';
import { STATIONS } from '@/mocks/stations';

/**
 * 관리자 자전거 목업 — AdminCycleController 실스키마 기준, CRUD가 없어 결정적으로 생성한다.
 * 자전거 ID 체계(DJ-1XXXX)는 제보 시드와 같아 자전거 상세의 제보 탭이
 * 제보 관리(msw_admin_claims)와 같은 데이터를 보게 된다.
 */
const CYCLE_COUNT = 90;

function mockCycleId(index: number): string {
  return `DJ-1${String(index).padStart(4, '0')}`;
}

function mockCycleSummary(index: number) {
  const cycleId = mockCycleId(index);
  // 일부는 대여(이동) 중 — 대여 중이면 현재 위치가 없다
  const renting = index % 9 === 4;
  const station = renting ? null : STATIONS[index % STATIONS.length];
  const claimCnt = getMockClaims().filter((c) => c.cycleId === cycleId).length;
  return {
    cycleId,
    currentLocation: station?.name ?? null,
    statement: renting ? 'RENTING' : 'READY',
    recentUsingAt: new Date(Date.now() - ((index * 97) % 5000) * 60_000).toISOString(),
    claimCnt,
  };
}

function mockCycleHistory(index: number) {
  return Array.from({ length: 10 }, (_, j) => {
    const userId = ((index + j * 7) % 30) + 1;
    return {
      recordId: index * 100 + j,
      usingAt: new Date(Date.now() - (j * 13 + index) * 3600_000).toISOString(),
      startingPoint: STATIONS[(index + j) % STATIONS.length].name,
      endPoint: STATIONS[(index + j * 3 + 1) % STATIONS.length].name,
      userId,
      nickname: mockUserNickname(userId),
    };
  });
}

/**
 * 관리자 자전거 관리 (05·07 — AdminCycleController 실측 스키마).
 * ⚠ 고정 경로(list·statics)는 아래 :cycleId 핸들러들보다 먼저 등록한다
 */
export const adminCycleHandlers = [
  http.get('/api/admin/cycle/list', async () => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const cycles = Array.from({ length: CYCLE_COUNT }, (_, i) => mockCycleSummary(i));
    return HttpResponse.json(ok(cycles));
  }),

  http.get('/api/admin/cycle/statics', async () => {
    await delay(300);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const cycles = Array.from({ length: CYCLE_COUNT }, (_, i) => mockCycleSummary(i));
    return HttpResponse.json(
      ok({
        totalCycleCnt: cycles.length,
        rentCycleCnt: cycles.filter((c) => c.statement === 'RENTING').length,
        waitCycleCnt: cycles.filter((c) => c.statement === 'READY').length,
        claimCycleCnt: cycles.filter((c) => c.claimCnt > 0).length,
      }),
    );
  }),

  http.get('/api/admin/cycle/:cycleId/statics', async ({ params }) => {
    await delay(250);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const cycleId = String(params.cycleId);
    const index = Number(cycleId.slice(-4));
    if (Number.isNaN(index) || index >= CYCLE_COUNT) return fail(404, '존재하지 않는 자전거입니다.');
    const unresolvedClaim = getMockClaims().filter(
      (c) => c.cycleId === cycleId && c.status === 'READY',
    ).length;
    return HttpResponse.json(
      ok({
        usingCnt: 40 + ((index * 7) % 160),
        recentUsingAt: new Date(Date.now() - ((index * 97) % 5000) * 60_000).toISOString(),
        unresolvedClaim,
        registeredAt: new Date(Date.now() - (300 + index * 2) * 24 * 3600_000).toISOString(),
      }),
    );
  }),

  http.get('/api/admin/cycle/:cycleId/claim', async ({ params }) => {
    await delay(300);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const cycleId = String(params.cycleId);
    const claims = getMockClaims()
      .filter((c) => c.cycleId === cycleId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toListItem);
    return HttpResponse.json(ok(claims));
  }),

  // 자전거 이용 이력 — 백엔드는 요약 없이 이력 리스트만 준다
  http.get('/api/admin/cycle/:cycleId', async ({ params }) => {
    await delay(350);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const cycleId = String(params.cycleId);
    const index = Number(cycleId.slice(-4));
    if (!/^DJ-1\d{4}$/.test(cycleId) || Number.isNaN(index) || index >= CYCLE_COUNT) {
      return fail(404, '존재하지 않는 자전거입니다.');
    }
    return HttpResponse.json(ok(mockCycleHistory(index)));
  }),
];
