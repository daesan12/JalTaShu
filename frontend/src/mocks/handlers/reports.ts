import { delay, http, HttpResponse } from 'msw';
import { fail, getAuthState, ok, requireAuth } from '@/mocks/core';
import { getMockClaims } from '@/mocks/handlers/adminClaims';
import { STATIONS } from '@/mocks/stations';

/** 가짜 민원 내역 — 새로고침에도 유지되도록 localStorage 사용 */
const REPORTS_KEY = 'msw_reports';

interface MockReport {
  id: number;
  type: string;
  bikeCode: string | null;
  tag: string | null;
  tagDetail: string | null;
  content: string;
  nickname: string;
  status: string;
  createdAt: string;
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
 * 이미 대여 중인 것으로 취급할 자전거 번호 — 대여 실패 경로를 검증할 때 이 값을 넣는다.
 * QrScanPage의 수동 입력 예시(22B01262)와 일부러 맞췄다 — 그 화면을 참고해 코드를 입력해도
 * 실패 케이스를 재현할 수 있게
 */
const RENTED_CYCLE_IDS = ['22B01262'];

/** 민원(17-x)·자전거 상태(18)·대여/반납 — 백엔드 API 미정, 임시 스키마 */
export const reportHandlers = [
  http.post('/api/reports', async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as {
      type?: string;
      bikeCode?: string | null;
      tag?: string | null;
      tagDetail?: string | null;
      content?: string;
    };
    if (!body.content?.trim()) return fail(400, '상세내용을 입력해 주세요.');
    const reports = getMockReports();
    reports.unshift({
      id: Date.now(),
      type: body.type ?? 'inquiry',
      bikeCode: body.bikeCode ?? null,
      tag: body.tag ?? null,
      tagDetail: body.tagDetail ?? null,
      content: body.content,
      nickname: getAuthState().nickname ?? '익명',
      status: '접수됨',
      createdAt: new Date().toISOString(),
    });
    setMockReports(reports);
    return HttpResponse.json({ code: 200, message: '민원이 접수되었습니다.', data: null });
  }),

  http.get('/api/reports/my', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    return HttpResponse.json(ok(getMockReports()));
  }),

  // ── 자전거 (18 자전거 상태 — 백엔드 API 미정, 임시 스키마) ──────────
  http.get('/api/bikes/:code', async ({ params }) => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const code = String(params.code);
    const dayMs = 24 * 60 * 60 * 1000;

    // 내가 접수한 고장신고 중 이 자전거에 달린 것 = 제보로 노출
    const myReports = getMockReports()
      .filter((r) => r.type === 'broken' && r.bikeCode === code)
      .map((r) => ({
        tag: r.tag ?? '기타',
        tagDetail: r.tagDetail ?? null,
        content: r.content,
        nickname: r.nickname,
        createdAt: r.createdAt,
      }));

    // 데모용 씨앗 제보 (1로 끝나는 코드는 깨끗한 자전거 — 다이어그램 기본 상태 확인용)
    const seedReports = code.endsWith('1')
      ? []
      : [
          {
            tag: '브레이크',
            tagDetail: null,
            content: '브레이크가 잘 안 잡혀요',
            nickname: '달리는거북',
            createdAt: new Date(Date.now() - 3 * dayMs).toISOString(),
          },
          {
            tag: '타이어',
            tagDetail: null,
            content: '앞바퀴 공기압이 낮아요',
            nickname: '바퀴요정',
            createdAt: new Date(Date.now() - 5 * dayMs).toISOString(),
          },
          {
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

  // ── 자전거 제보 리스트 (20 — CycleClaimListResponse 실측) ─────────────
  // 관리자 제보 저장소와 같은 데이터를 자전거 기준으로 거른다
  http.get('/api/cycle/list', async ({ request }) => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const cycleId = new URL(request.url).searchParams.get('cycleId') ?? '';
    if (!cycleId) return fail(400, '자전거 번호가 필요합니다.');
    const claims = getMockClaims()
      .filter((c) => c.cycleId.toUpperCase() === cycleId.toUpperCase())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => ({
        claimId: c.claimId,
        nickname: c.nickname,
        claimCategory: c.category,
        content: c.content,
        createdAt: c.createdAt,
      }));
    return HttpResponse.json(ok(claims));
  }),

  http.post('/api/cycle/rental', async ({ request }) => {
    await delay(500);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const body = (await request.json()) as { cycleId?: string };
    const cycleId = body.cycleId?.trim().toUpperCase();
    if (!cycleId) return fail(400, '자전거 번호를 입력해 주세요.');
    if (RENTED_CYCLE_IDS.includes(cycleId)) {
      return fail(409, '이미 대여 중인 자전거입니다.');
    }
    return HttpResponse.json(ok(new Date().toISOString()));
  }),

  http.post('/api/cycle/return', async ({ request }) => {
    await delay(500);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const body = (await request.json()) as { cycleId?: string; stationId?: string };
    const cycleId = body.cycleId?.trim().toUpperCase();
    if (!cycleId) return fail(400, '자전거 번호를 입력해 주세요.');
    if (!body.stationId || !STATIONS.some((station) => station.stationId === body.stationId)) {
      return fail(404, '존재하지 않는 대여소입니다.');
    }
    if (!RENTED_CYCLE_IDS.includes(cycleId)) {
      return fail(409, '대여 중인 자전거가 아닙니다.');
    }
    return HttpResponse.json(ok(new Date().toISOString()));
  }),
];
