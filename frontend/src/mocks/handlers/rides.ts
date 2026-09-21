import { delay, http, HttpResponse } from 'msw';
import { fail, ok, requireAuth } from '@/mocks/core';
import { STATIONS } from '@/mocks/stations';

/**
 * 이동 기록 목업 (22·23) — CycleController /cycle/usage·statics 실측 스키마.
 * 출발·도착은 실제 대여소 좌표를 써서 화면의 "좌표 → 대여소 이름 복원"이 동작하게 한다.
 */

const USAGE_COUNT = 12;

/**
 * QR 대여·반납으로 **이번 세션에 실제로 만들어진** 이용 기록.
 * 씨앗 기록 12건과 달리 사용자의 조작에서 나오므로 따로 쌓고, 목록·상세에서 앞에 붙인다.
 * usageId는 씨앗과 겹치지 않게 USAGE_COUNT 위에서 센다.
 */
const LIVE_USAGES_KEY = 'msw_live_usages';

interface LiveUsage {
  usageId: number;
  cycleId: string;
  startingDate: string;
  totalDuration: number;
  startingPoint: { latitude: number; longitude: number };
  endPoint: { latitude: number; longitude: number };
  /** 안내 도착 저장(POST /cycle/usage)이 붙기 전에는 null */
  road: UsagePathPoint[] | null;
  totalDistance: number | null;
  bikeDistance: number | null;
}

interface UsagePathPoint {
  latitude: number;
  longitude: number;
  altitude: number;
  travelStatus: string;
  seq: number;
}

function readLiveUsages(): LiveUsage[] {
  try {
    const raw = localStorage.getItem(LIVE_USAGES_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LiveUsage[]) : [];
  } catch {
    return [];
  }
}

function writeLiveUsages(list: LiveUsage[]) {
  try {
    localStorage.setItem(LIVE_USAGES_KEY, JSON.stringify(list));
  } catch {
    // 저장 불가 환경 무시
  }
}

interface AddMockUsageInput {
  cycleId: string;
  stationId: string | undefined;
  rentedAt: string;
  returnedAt: string;
}

/**
 * 반납 시 이용 기록 한 건을 만든다(`/api/cycle/return`에서 호출).
 * 대여 대여소는 요청에 없어(실서버도 자전거 위치로 서버가 안다) 반납 대여소를 양쪽에 쓴다 —
 * 안내 도착 저장이 붙으면 경로의 처음·끝 좌표로 덮어써 제자리가 된다.
 */
export function addMockUsage({ cycleId, stationId, rentedAt, returnedAt }: AddMockUsageInput) {
  const station = STATIONS.find((s) => s.stationId === stationId) ?? STATIONS[0];
  const point = { latitude: station.lat, longitude: station.lng };
  const list = readLiveUsages();
  const nextId = Math.max(USAGE_COUNT, ...list.map((u) => u.usageId)) + 1;
  list.push({
    usageId: nextId,
    cycleId,
    startingDate: rentedAt,
    totalDuration: Math.max(
      60,
      Math.round((new Date(returnedAt).getTime() - new Date(rentedAt).getTime()) / 1000),
    ),
    startingPoint: point,
    endPoint: point,
    road: null,
    totalDistance: null,
    bikeDistance: null,
  });
  writeLiveUsages(list);
}

/**
 * 안내 도착 저장을 **가장 최근에 반납한 기록**에 붙인다 — 실서버와 같은 규칙.
 * 붙일 기록이 없으면 아무것도 하지 않는다(목업은 그 경우에도 저장을 거절하지 않는다).
 */
function attachMockPath(road: UsagePathPoint[], totalDistance: number, bikeDistance: number) {
  const list = readLiveUsages();
  const target = [...list].reverse().find((u) => u.road === null);
  if (target === undefined || road.length === 0) return;
  const sorted = [...road].sort((a, b) => a.seq - b.seq);
  target.road = sorted;
  target.totalDistance = totalDistance;
  target.bikeDistance = bikeDistance;
  target.startingPoint = { latitude: sorted[0].latitude, longitude: sorted[0].longitude };
  const last = sorted[sorted.length - 1];
  target.endPoint = { latitude: last.latitude, longitude: last.longitude };
  writeLiveUsages(list);
}

function stationPoint(index: number) {
  const station = STATIONS[index % STATIONS.length];
  return { latitude: station.lat, longitude: station.lng };
}

/** 출발-도착 직선거리(m) — 총거리가 경로 길이와 동떨어지지 않게 하버사인으로 잡는다 */
function straightDistanceM(a: { latitude: number; longitude: number }, b: typeof a): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** 이용 한 건의 결정적 기본값 — usageId가 클수록 최근 기록 */
function usageSeed(usageId: number) {
  const totalDuration = (9 + ((usageId * 7) % 20)) * 60; // 9~28분(초 단위)
  const startingDate = new Date(
    Date.now() - (USAGE_COUNT - usageId + 1) * 2.3 * 24 * 3600_000,
  ).toISOString();
  return {
    usageId,
    startingPoint: stationPoint(usageId),
    endPoint: stationPoint(usageId + 3),
    startingDate,
    totalDuration,
    cycleId: `DJ-1${String((usageId * 11) % 90).padStart(4, '0')}`,
  };
}

/** 두 대여소 사이를 잇는 GPS 경로 — WALK1 → BIKE(고도 언덕) → WALK2 */
function usageRoad(usageId: number) {
  const start = stationPoint(usageId);
  const end = stationPoint(usageId + 3);
  const points = 26;
  const hill = 20 + ((usageId * 13) % 40);
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    // 가운데가 옆으로 살짝 휘는 곡선 (usageId로 방향이 바뀐다)
    const bend = (usageId % 2 === 0 ? 1 : -1) * 0.15 * Math.sin(Math.PI * t);
    const travelStatus = i < 3 ? 'WALK1' : i >= points - 3 ? 'WALK2' : 'BIKE';
    return {
      latitude: start.latitude + (end.latitude - start.latitude) * t + bend * 0.01,
      longitude: start.longitude + (end.longitude - start.longitude) * t,
      altitude: 50 + Math.round(Math.sin(Math.PI * t) * hill),
      travelStatus,
      seq: i,
    };
  });
}

export const rideHandlers = [
  /**
   * 경로 기록 저장 (12 안내 도착) — 실서버 POST /cycle/usage.
   * 실서버는 가장 최근 반납 건에 붙이고, 이용 기록이 없거나 이미 저장됐으면 거절한다.
   * 목업은 그 검증을 흉내 내지 않고 형식만 확인한다 — 여기서 막으면 로컬에서
   * 도착 요약까지 가는 흐름 자체를 볼 수 없다.
   */
  http.post('/api/cycle/usage', async ({ request }) => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const body = (await request.json()) as {
      pathInfo?: { road?: unknown[] };
      createdAt?: string;
      finishedAt?: string;
      totalDistance?: number;
      bikeDistance?: number;
    };
    if (!body.pathInfo?.road?.length) return fail(400, '경로 좌표가 필요합니다.');
    if (!body.createdAt || !body.finishedAt) return fail(400, '이동 시각이 필요합니다.');
    if (new Date(body.finishedAt) < new Date(body.createdAt)) {
      return fail(400, '종료 시각은 시작 시각보다 빠를 수 없습니다.');
    }
    const total = body.totalDistance ?? 0;
    const bike = body.bikeDistance ?? 0;
    if (total < 0 || bike < 0) return fail(400, '거리는 0보다 작을 수 없습니다.');
    if (bike > total) return fail(400, '자전거 거리는 전체 거리보다 클 수 없습니다.');
    attachMockPath(body.pathInfo.road as UsagePathPoint[], total, bike);
    return HttpResponse.json(ok(null));
  }),

  // ── 개인 누적 통계 (CycleStatisticsResponse — 거리 m, 시간 초) ──────
  http.get('/api/cycle/statics', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    // 이번 세션에 만든 기록도 더해야 반납할 때마다 숫자가 움직인다
    const live = readLiveUsages();
    return HttpResponse.json(
      ok({
        totalUseCnt: 42 + live.length,
        totalDistance: 128_400 + live.reduce((sum, u) => sum + (u.totalDistance ?? 0), 0),
        totalCycleRidingTime: 58_320 + live.reduce((sum, u) => sum + u.totalDuration, 0),
      }),
    );
  }),

  // ── 이용 내역 목록 — 페이지네이션 없이 최근 대여일 순 전체 ──────────
  http.get('/api/cycle/usage/list', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const seeded = Array.from({ length: USAGE_COUNT }, (_, i) => usageSeed(USAGE_COUNT - i));
    // 방금 반납한 기록이 맨 위에 온다
    const live = readLiveUsages()
      .slice()
      .reverse()
      .map(({ usageId, cycleId, startingDate, totalDuration, startingPoint, endPoint }) => ({
        usageId,
        cycleId,
        startingDate,
        totalDuration,
        startingPoint,
        endPoint,
      }));
    return HttpResponse.json(ok([...live, ...seeded]));
  }),

  http.get('/api/cycle/usage/:usageId', async ({ params }) => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const usageId = Number(params.usageId);
    const live = readLiveUsages().find((u) => u.usageId === usageId);
    if (live !== undefined) {
      const startMs = new Date(live.startingDate).getTime();
      return HttpResponse.json(
        ok({
          usageId: live.usageId,
          cycleId: live.cycleId,
          startingDate: live.startingDate,
          totalDuration: live.totalDuration,
          startingPoint: live.startingPoint,
          endPoint: live.endPoint,
          totalDistance: live.totalDistance,
          averageCycleRidingSpeed:
            live.bikeDistance === null || live.totalDuration === 0
              ? null
              : Math.round((live.bikeDistance / 1000 / (live.totalDuration / 3600)) * 10) / 10,
          pathInfo: live.road === null ? null : { road: live.road },
          cycleRidingStartTime: new Date(startMs).toISOString(),
          cycleRidingEndTime: new Date(startMs + live.totalDuration * 1000).toISOString(),
        }),
      );
    }
    if (!Number.isInteger(usageId) || usageId < 1 || usageId > USAGE_COUNT) {
      return fail(404, '존재하지 않는 이동 기록입니다.');
    }
    const seed = usageSeed(usageId);
    const startMs = new Date(seed.startingDate).getTime();
    // 앞뒤 도보를 뺀 자전거 탑승 구간 시각
    const walkSec = Math.round(seed.totalDuration * 0.15);
    // 3의 배수 기록은 경로를 저장하지 않은 기록 — pathInfo 없는 화면도 확인할 수 있게
    const hasPath = usageId % 3 !== 0;
    const road = hasPath ? usageRoad(usageId) : null;
    // 실제 경로가 곡선이라 직선거리의 1.25배쯤으로 — 구간 안내의 거리 합과 결이 맞는다
    const totalDistance = hasPath
      ? Math.round(straightDistanceM(seed.startingPoint, seed.endPoint) * 1.25)
      : null;
    return HttpResponse.json(
      ok({
        ...seed,
        totalDistance,
        averageCycleRidingSpeed: hasPath ? 11 + ((usageId * 3) % 7) : null,
        pathInfo: road === null ? null : { road },
        cycleRidingStartTime: new Date(startMs + walkSec * 1000).toISOString(),
        cycleRidingEndTime: new Date(
          startMs + (seed.totalDuration - walkSec) * 1000,
        ).toISOString(),
      }),
    );
  }),
];
