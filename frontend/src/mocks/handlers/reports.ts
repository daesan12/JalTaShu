import { delay, http, HttpResponse } from 'msw';
import { addMockUsage } from '@/mocks/handlers/rides';
import { fail, getAuthState, ok, requireAuth } from '@/mocks/core';
import { getMockClaims } from '@/mocks/handlers/adminClaims';
import { STATIONS } from '@/mocks/stations';
import { haversineMeters } from '@/shared/lib/coords';
import { CYCLE_STATION_RADIUS_M } from '@/features/map/lib/nearestStation';

/** 내가 접수한 민원 — 새로고침에도 유지되도록 localStorage 사용 */
const REPORTS_KEY = 'msw_reports';

/** 백엔드 ClaimListResponse와 같은 모양으로 저장한다 (자전거 코드는 18 목업에서만 쓴다) */
interface MockReport {
  claimId: number;
  claimType: 'CYCLE' | 'ABANDONED' | 'ETC';
  claimCategory: string | null;
  content: string;
  nickname: string;
  createdAt: string;
  /** 응답에는 없지만 18 자전거 상태 목업이 자전거별로 거르는 데 쓴다 */
  cycleId: string | null;
}

function getMockReports(): MockReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    if (raw) return JSON.parse(raw) as MockReport[];
  } catch {
    // 파싱 실패 시 빈 목록
  }
  return [];
}

/** 회원 탈퇴(auth)에서도 비운다 */
export function setMockReports(reports: MockReport[]) {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch {
    // 저장 불가 환경 무시
  }
}

/**
 * 지금 대여 중인 자전거 번호들.
 *
 * 처음부터 한 대(22B01262)를 빌려간 것으로 둔다 — 대여 실패 경로를 바로 재현할 수 있게
 * `QrScanPage`의 수동 입력 예시와 일부러 맞춘 번호다.
 * 대여·반납이 실제로 이 목록을 고쳐야 "QR로 빌리고 같은 QR로 반납"이 로컬에서도 돌아간다.
 */
const RENTED_KEY = 'msw_rented_cycles';

/** 자전거 번호 → 대여 시각(ISO). 반납할 때 이용 시간을 계산하려면 시작 시각이 있어야 한다 */
type RentedCycles = Record<string, string>;

function readRentedCycles(): RentedCycles {
  try {
    const raw = localStorage.getItem(RENTED_KEY);
    if (raw === null) return { '22B01262': new Date(Date.now() - 20 * 60_000).toISOString() };
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as RentedCycles;
  } catch {
    return {};
  }
}

function writeRentedCycles(rented: RentedCycles) {
  try {
    localStorage.setItem(RENTED_KEY, JSON.stringify(rented));
  } catch {
    // 저장 불가 환경 무시
  }
}

/** 저장된 enum을 18 화면의 부위 태그로 되돌린다 */
const CATEGORY_TO_TAG: Record<string, string> = {
  BREAK: '브레이크',
  TIRE: '타이어',
  SADDLE: '안장',
  CHAIN: '체인',
  FRAME: '프레임',
  ETC: '기타',
};

/** 접수 한 건을 저장하고 claimId를 돌려준다 (세 유형 공용) */
function addClaim(
  claimType: MockReport['claimType'],
  content: string,
  claimCategory: string | null,
  cycleId: string | null,
) {
  const reports = getMockReports();
  const claimId = Date.now();
  reports.unshift({
    claimId,
    claimType,
    claimCategory,
    content,
    nickname: getAuthState().nickname ?? '익명',
    createdAt: new Date().toISOString(),
    cycleId,
  });
  setMockReports(reports);
  return claimId;
}

const CLAIM_CATEGORIES = ['BREAK', 'TIRE', 'SADDLE', 'CHAIN', 'FRAME', 'ETC'];

/** 민원 접수(17-x)·자전거 상태(18)·대여/반납 */
export const reportHandlers = [
  // ── 고장 제보 (17-1) — multipart: cycleId·claimCategory·content·file ──────
  http.post('/api/claim/cycle', async ({ request }) => {
    await delay(400);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const form = await request.formData();
    const cycleId = String(form.get('cycleId') ?? '').trim();
    const content = String(form.get('content') ?? '').trim();
    const category = String(form.get('claimCategory') ?? '');
    if (!cycleId) return fail(400, '자전거 번호가 필요합니다.');
    if (!content) return fail(400, '상세내용을 입력해 주세요.');
    if (!CLAIM_CATEGORIES.includes(category)) return fail(400, '고장 부위를 선택해 주세요.');
    return HttpResponse.json(ok({ claimId: addClaim('CYCLE', content, category, cycleId) }));
  }),

  // ── 방치 신고 (17-2) — multipart: cycleId·content·file ────────────────────
  http.post('/api/claim/abandoned', async ({ request }) => {
    await delay(400);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const form = await request.formData();
    const cycleId = String(form.get('cycleId') ?? '').trim();
    const content = String(form.get('content') ?? '').trim();
    if (!cycleId) return fail(400, '자전거 번호가 필요합니다.');
    if (!content) return fail(400, '상세내용을 입력해 주세요.');
    return HttpResponse.json(ok({ claimId: addClaim('ABANDONED', content, null, cycleId) }));
  }),

  // ── 기타 문의 (17-3) — JSON: content ──────────────────────────────────────
  http.post('/api/claim/etc', async ({ request }) => {
    await delay(400);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const body = (await request.json()) as { content?: string };
    const content = body.content?.trim() ?? '';
    if (!content) return fail(400, '상세내용을 입력해 주세요.');
    return HttpResponse.json(ok({ claimId: addClaim('ETC', content, null, null) }));
  }),

  // ── 내 민원 목록 (17-4) — 처리 상태·자전거 코드는 응답에 없다 ─────────────
  http.get('/api/claim/list/me', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const mine = getMockReports().map(({ cycleId: _cycleId, ...rest }) => rest);
    return HttpResponse.json(ok(mine));
  }),

  // ── 자전거 (18 자전거 상태 — 백엔드 API 미정, 임시 스키마) ──────────
  http.get('/api/bikes/:code', async ({ params }) => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const code = String(params.code);
    const dayMs = 24 * 60 * 60 * 1000;

    // 내가 접수한 고장신고 중 이 자전거에 달린 것 = 제보로 노출
    // claimId는 허위 제보 신고에 쓰인다 — 민원 id와 겹치지 않게 큰 수를 얹는다
    const myReports = getMockReports()
      .filter((r) => r.claimType === 'CYCLE' && r.cycleId === code)
      .map((r) => ({
        claimId: r.claimId,
        claimType: 'CYCLE' as const,
        tag: CATEGORY_TO_TAG[r.claimCategory ?? 'ETC'] ?? '기타',
        tagDetail: null,
        content: r.content,
        nickname: r.nickname,
        createdAt: r.createdAt,
      }));

    // 데모용 씨앗 제보 (1로 끝나는 코드는 깨끗한 자전거 — 다이어그램 기본 상태 확인용)
    const seedReports = code.endsWith('1')
      ? []
      : [
          {
            claimId: 9001,
            claimType: 'CYCLE' as const,
            tag: '브레이크',
            tagDetail: null,
            content: '브레이크가 잘 안 잡혀요',
            nickname: '달리는거북',
            createdAt: new Date(Date.now() - 3 * dayMs).toISOString(),
          },
          {
            claimId: 9002,
            claimType: 'CYCLE' as const,
            tag: '타이어',
            tagDetail: null,
            content: '앞바퀴 공기압이 낮아요',
            nickname: '바퀴요정',
            createdAt: new Date(Date.now() - 5 * dayMs).toISOString(),
          },
          {
            claimId: 9003,
            claimType: 'CYCLE' as const,
            tag: '안장',
            tagDetail: null,
            content: '안장 높이가 고정되지 않아요',
            nickname: '둔산라이더',
            createdAt: new Date(Date.now() - 8 * dayMs).toISOString(),
          },
        ];

    return HttpResponse.json(
      ok({
        code,
        rideable: !code.endsWith('0'), // 0으로 끝나는 코드는 점검 필요 상태 (상태 배지 확인용)
        lastUsedAt: new Date(Date.now() - 2 * dayMs).toISOString(),
        lastStationName: '유성구청역 대여소',
        reports: [...myReports, ...seedReports],
      }),
    );
  }),

  // ── 자전거 제보 리스트 (20 — ClaimListResponse 실측) ──────────────────
  // 관리자 제보 저장소와 같은 데이터를 자전거 기준으로 거른다
  http.get('/api/claim/list', async ({ request }) => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const cycleId = new URL(request.url).searchParams.get('cycleId') ?? '';
    if (!cycleId) return fail(400, '자전거 번호가 필요합니다.');
    const claims = getMockClaims()
      // 기타 문의는 자전거가 없다(null) — 자전거 기준 목록에서는 빠진다
      .filter((c) => c.cycleId?.toUpperCase() === cycleId.toUpperCase())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => ({
        claimId: c.claimId,
        claimType: c.claimType,
        nickname: c.nickname,
        claimCategory: c.category,
        content: c.content,
        createdAt: c.createdAt,
      }));
    return HttpResponse.json(ok(claims));
  }),

  /**
   * 허위 제보 신고 (18·20) — 실서버 POST /claim/{claimId}/report.
   * 실서버는 없는 claimId에 404를 주지만, 18 자전거 상태가 아직 목업 시드(9001~)를 쓰므로
   * 여기서는 형식만 확인하고 받아 준다. 횟수 제한은 서버에 없다 — 화면 쪽 가드가 맡는다.
   */
  http.post('/api/claim/:claimId/report', async ({ params, request }) => {
    await delay(400);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const claimId = Number(params.claimId);
    if (!Number.isInteger(claimId) || claimId < 1) {
      return fail(400, '잘못된 제보 번호입니다.');
    }
    const body = (await request.json()) as { claimCategory?: string };
    const allowed = ['FALSE_INFORMATION', 'PRANK_REPORT', 'ABUSE', 'ETC'];
    if (!body.claimCategory || !allowed.includes(body.claimCategory)) {
      return fail(400, '신고 사유를 선택해 주세요.');
    }
    return HttpResponse.json({ code: 200, message: '신고가 접수되었습니다.', data: null });
  }),

  http.post('/api/cycle/rental', async ({ request }) => {
    await delay(500);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const body = (await request.json()) as {
      cycleId?: string;
      stationId?: string;
      latitude?: number;
      longitude?: number;
    };
    const cycleId = body.cycleId?.trim().toUpperCase();
    if (!cycleId) return fail(400, '자전거 번호를 입력해 주세요.');
    // 서버가 처음 보는 자전거를 이때 등록하므로(지연 등록) 번호 형식을 서버도 검증한다
    if (!/^[A-Z0-9]{6,12}$/.test(cycleId))
      return fail(400, '자전거 번호 형식이 올바르지 않습니다.');
    // 출발 대여소는 선택값 — 위치 권한이 없으면 오지 않는다
    const station = STATIONS.find((item) => item.stationId === body.stationId);
    if (station === undefined) {
      return fail(404, '존재하지 않는 대여소입니다.');
    }
    if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number'
        || !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) {
      return fail(400, '현재 위치를 확인할 수 없습니다.');
    }
    const distance = haversineMeters(
      { lat: body.latitude, lng: body.longitude },
      { lat: station.lat, lng: station.lng },
    );
    if (distance > CYCLE_STATION_RADIUS_M) {
      return fail(400, `대여소 ${CYCLE_STATION_RADIUS_M}m 이내에서 이용해 주세요.`);
    }
    const rented = readRentedCycles();
    if (cycleId in rented) {
      return fail(409, '이미 대여 중인 자전거입니다.');
    }
    const rentedAt = new Date().toISOString();
    writeRentedCycles({ ...rented, [cycleId]: rentedAt });
    return HttpResponse.json(ok(rentedAt));
  }),

  http.post('/api/cycle/return', async ({ request }) => {
    await delay(500);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const body = (await request.json()) as {
      cycleId?: string;
      stationId?: string;
      latitude?: number;
      longitude?: number;
    };
    const cycleId = body.cycleId?.trim().toUpperCase();
    if (!cycleId) return fail(400, '자전거 번호를 입력해 주세요.');
    const station = STATIONS.find((item) => item.stationId === body.stationId);
    if (station === undefined) {
      return fail(404, '존재하지 않는 대여소입니다.');
    }
    if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number'
        || !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) {
      return fail(400, '현재 위치를 확인할 수 없습니다.');
    }
    const distance = haversineMeters(
      { lat: body.latitude, lng: body.longitude },
      { lat: station.lat, lng: station.lng },
    );
    if (distance > CYCLE_STATION_RADIUS_M) {
      return fail(400, `대여소 ${CYCLE_STATION_RADIUS_M}m 이내에서 이용해 주세요.`);
    }
    const rented = readRentedCycles();
    const rentedAt = rented[cycleId];
    if (rentedAt === undefined) {
      return fail(409, '대여 중인 자전거가 아닙니다.');
    }
    const { [cycleId]: _removed, ...rest } = rented;
    writeRentedCycles(rest);
    // 실서버는 여기서 이용 기록 한 건을 만든다 — 목업도 만들어야 "나의 경로"까지 이어진다
    const returnedAt = new Date().toISOString();
    addMockUsage({ cycleId, stationId: body.stationId, rentedAt, returnedAt });
    return HttpResponse.json(ok(returnedAt));
  }),
];
