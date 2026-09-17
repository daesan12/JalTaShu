import { delay, http, HttpResponse } from 'msw';
import { fail, isAdminLoggedIn, ok } from '@/mocks/core';
import { getMockClaims } from '@/mocks/handlers/adminClaims';
import { STATIONS } from '@/mocks/stations';

/**
 * 관리자 자전거 목업 — CRUD가 없어 저장소 없이 결정적으로 생성한다.
 * 자전거 ID 체계(DJ-1XXXX)는 제보 시드와 같아 자전거 상세의 제보 탭이
 * 제보 관리(msw_admin_claims)와 같은 데이터를 보게 된다.
 */
const CYCLE_COUNT = 90;

function mockCycleId(index: number): string {
  return `DJ-1${String(index).padStart(4, '0')}`;
}

function mockCycleSummary(index: number) {
  const cycleId = mockCycleId(index);
  // 일부는 대여(이동) 중이라 배치 대여소가 없다
  const station = index % 9 === 4 ? null : STATIONS[index % STATIONS.length];
  const openClaimCnt = getMockClaims().filter(
    (c) => c.cycleId === cycleId && c.statement === 'OPEN',
  ).length;
  return {
    cycleId,
    stationId: station?.stationId ?? null,
    stationName: station?.name ?? null,
    statement: index % 9 === 2 ? 'SUSPENDED' : 'ACTIVE',
    openClaimCnt,
    lastUsedAt: new Date(Date.now() - ((index * 97) % 5000) * 60_000).toISOString(),
  };
}

function mockCycleRides(index: number) {
  return Array.from({ length: 10 }, (_, j) => {
    const durationMin = 8 + ((index + j * 5) % 35);
    const end = Date.now() - (j * 13 + index) * 3600_000;
    return {
      rideId: index * 100 + j,
      startAt: new Date(end - durationMin * 60_000).toISOString(),
      endAt: new Date(end).toISOString(),
      fromStation: STATIONS[(index + j) % STATIONS.length].name,
      toStation: STATIONS[(index + j * 3 + 1) % STATIONS.length].name,
      durationMin,
      distanceKm: Number((durationMin * 0.21).toFixed(1)),
    };
  });
}

/**
 * 관리자 자전거 관리 (05·07 — 제보 탭 외 구현 O, 응답 형태 임시).
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
        totalCnt: cycles.length,
        activeCnt: cycles.filter((c) => c.statement === 'ACTIVE').length,
        suspendedCnt: cycles.filter((c) => c.statement === 'SUSPENDED').length,
        claimedCnt: cycles.filter((c) => c.openClaimCnt > 0).length,
      }),
    );
  }),

  http.get('/api/admin/cycle/:cycleId/statics', async ({ params }) => {
    await delay(250);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const index = Number(String(params.cycleId).slice(-4));
    if (Number.isNaN(index) || index >= CYCLE_COUNT) return fail(404, '존재하지 않는 자전거입니다.');
    return HttpResponse.json(
      ok({
        totalRides: 40 + ((index * 7) % 160),
        totalDistanceKm: Number((80 + ((index * 13) % 300) + index / 10).toFixed(1)),
        totalDurationMin: 600 + ((index * 41) % 2400),
      }),
    );
  }),

  http.get('/api/admin/cycle/:cycleId/claim', async ({ params }) => {
    await delay(300);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const cycleId = String(params.cycleId);
    const claims = getMockClaims()
      .filter((c) => c.cycleId === cycleId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(ok(claims));
  }),

  http.get('/api/admin/cycle/:cycleId', async ({ params }) => {
    await delay(350);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const cycleId = String(params.cycleId);
    const index = Number(cycleId.slice(-4));
    if (!/^DJ-1\d{4}$/.test(cycleId) || Number.isNaN(index) || index >= CYCLE_COUNT) {
      return fail(404, '존재하지 않는 자전거입니다.');
    }
    return HttpResponse.json(ok({ ...mockCycleSummary(index), rides: mockCycleRides(index) }));
  }),
];
