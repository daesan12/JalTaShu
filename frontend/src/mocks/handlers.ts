import { delay, http, HttpResponse } from 'msw';
import type { ApiResponse, BikeStation, Station, StationPrediction } from '@/shared/api/types';
import {
  NICKNAME_MAX,
  NICKNAME_MIN,
  NICKNAME_PATTERN,
  PREDICTION_HORIZONS,
  TERMS,
} from '@/shared/config/constants';

/** 백엔드 공통 래퍼와 동일한 형태로 감싸기 */
function ok<T>(data: T): ApiResponse<T> {
  return { code: 200, message: 'OK', data };
}

function fail(code: number, message: string) {
  return HttpResponse.json({ code, message, data: null }, { status: code });
}

/** 백엔드는 모든 API가 세션 필수(.anyRequest().authenticated()) — 동일하게 흉내 */
function requireAuth() {
  return getAuthState().loggedIn ? null : fail(401, '로그인이 필요합니다.');
}

/** 가짜 로그인 세션 — 새로고침에도 유지되도록 localStorage 사용 (개발 초기화: 브라우저 저장소 삭제) */
const AUTH_STATE_KEY = 'msw_auth_state';

interface MockAuthState {
  loggedIn: boolean;
  nickname: string | null;
}

function getAuthState(): MockAuthState {
  try {
    const raw = localStorage.getItem(AUTH_STATE_KEY);
    if (raw) return JSON.parse(raw) as MockAuthState;
  } catch {
    // 파싱 실패 시 초기 상태
  }
  return { loggedIn: false, nickname: null };
}

function setAuthState(state: MockAuthState) {
  try {
    localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(state));
  } catch {
    // 저장 불가 환경 무시
  }
}

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

function setMockReports(reports: MockReport[]) {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch {
    // 저장 불가 환경 무시
  }
}

/** 가짜 Open API 신청 내역 — 새로고침에도 유지되도록 localStorage 사용 */
const OPEN_API_KEY = 'msw_openapi_requests';

interface MockOpenApiRequest {
  id: number;
  purpose: string;
  reason: string;
  status: string;
  createdAt: string;
}

function getOpenApiRequests(): MockOpenApiRequest[] {
  try {
    const raw = localStorage.getItem(OPEN_API_KEY);
    if (raw) return JSON.parse(raw) as MockOpenApiRequest[];
  } catch {
    // 파싱 실패 시 빈 목록
  }
  return [];
}

function setOpenApiRequests(requests: MockOpenApiRequest[]) {
  try {
    localStorage.setItem(OPEN_API_KEY, JSON.stringify(requests));
  } catch {
    // 저장 불가 환경 무시
  }
}

/** 대전 실제 좌표 기반 목업 대여소 (07-1 팝업 와이어프레임 데이터 반영) */
const STATIONS: Station[] = [
  { stationId: 'ST0001', name: '유성구청역 대여소', lat: 36.362, lng: 127.3565, currentBikes: 7 },
  { stationId: 'ST0002', name: '월드컵경기장역 대여소', lat: 36.3664, lng: 127.3216, currentBikes: 3 },
  { stationId: 'ST0003', name: '시청역 대여소', lat: 36.3505, lng: 127.3848, currentBikes: 1 },
  { stationId: 'ST0004', name: '대전역 대여소', lat: 36.3315, lng: 127.4346, currentBikes: 5 },
  { stationId: 'ST0005', name: '충남대학교 정문', lat: 36.3623, lng: 127.3442, currentBikes: 0 },
  { stationId: 'ST0006', name: '갑천네이처브리지', lat: 36.3688, lng: 127.3893, currentBikes: 8 },
  { stationId: 'ST0007', name: '카이스트 본원', lat: 36.3722, lng: 127.3604, currentBikes: 2 },
  { stationId: 'ST0008', name: '한밭수목원', lat: 36.3667, lng: 127.3887, currentBikes: 11 },
];

export const handlers = [
  // ── 인증 (백엔드 세션 쿠키 방식을 흉내) ─────────────────────────────
  http.get('/api/users/me', async () => {
    await delay(300);
    const state = getAuthState();
    if (!state.loggedIn) return fail(401, '로그인이 필요합니다.');
    return HttpResponse.json(ok({ nickname: state.nickname }));
  }),

  // ── 공지사항 (고객센터 — 백엔드 API 미정, 임시 스키마) ──────────────
  http.get('/api/notices', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    return HttpResponse.json(
      ok([
        { id: 5, title: '임시 폐쇄 대여소 안내 (2026. 9. 10.)', date: '2026/09/10' },
        { id: 4, title: '♣2026년 공공 데이터 활용 설문조사 실시', date: '2026/08/25' },
        { id: 3, title: '공영자전거 타슈 이용약관 개정 알림', date: '2026/04/10' },
        { id: 2, title: '"타슈" 대여 전 안전수칙 확인 후 대여하도록 절차 개선', date: '2025/10/28' },
        { id: 1, title: '타슈 대여소에 반드시 반납해주세요!!!', date: '2023/08/02' },
      ]),
    );
  }),

  // ── Open API 신청 (자전거 정보 — 백엔드 API 미정, 임시 스키마) ──────
  http.post('/api/open-api/requests', async ({ request }) => {
    await delay(400);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const body = (await request.json()) as { purpose?: string; reason?: string };
    if (!body.purpose || !body.reason?.trim()) {
      return fail(400, '활용구분과 신청사유를 입력해 주세요.');
    }
    const requests = getOpenApiRequests();
    requests.unshift({
      id: Date.now(),
      purpose: body.purpose,
      reason: body.reason,
      status: '접수됨',
      createdAt: new Date().toISOString(),
    });
    setOpenApiRequests(requests);
    return HttpResponse.json({ code: 200, message: 'Open API 신청이 접수되었습니다.', data: null });
  }),

  http.get('/api/open-api/requests', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    return HttpResponse.json(ok(getOpenApiRequests()));
  }),

  // ── 프로필 (24 — 백엔드 API 미정, 임시 스키마) ─────────────────────
  http.get('/api/users/me/stats', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    return HttpResponse.json(ok({ monthlyRides: 12, distanceKm: 38.2, durationMin: 84 }));
  }),

  http.put('/api/users/me', async ({ request }) => {
    await delay(400);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const body = (await request.json()) as { nickname?: string };
    const nickname = body.nickname ?? '';
    if (
      nickname.length < NICKNAME_MIN ||
      nickname.length > NICKNAME_MAX ||
      !NICKNAME_PATTERN.test(nickname)
    ) {
      return fail(400, '닉네임 형식이 올바르지 않습니다.');
    }
    setAuthState({ loggedIn: true, nickname });
    return HttpResponse.json({ code: 200, message: '닉네임이 변경되었습니다.', data: null });
  }),

  // 회원 탈퇴 — 백엔드 API 미정. 계정·데이터를 모두 삭제한다
  http.post('/api/users/withdraw', async () => {
    await delay(500);
    const authFail = requireAuth();
    if (authFail) return authFail;
    setAuthState({ loggedIn: false, nickname: null });
    setMockReports([]);
    setOpenApiRequests([]);
    return HttpResponse.json({ code: 200, message: '탈퇴가 완료되었습니다.', data: null });
  }),

  // 백엔드에 로그아웃 API가 아직 없음 — 확정 시 경로 맞출 것
  http.post('/api/auth/logout', async () => {
    await delay(300);
    setAuthState({ loggedIn: false, nickname: getAuthState().nickname });
    return HttpResponse.json(ok(null));
  }),

  // 실제 백엔드에는 없는 개발용 엔드포인트 — 카카오 OAuth 리다이렉트를 대신함
  http.post('/api/auth/mock-login', async () => {
    await delay(400);
    const state = getAuthState();
    setAuthState({ ...state, loggedIn: true });
    return HttpResponse.json(ok(null));
  }),

  http.post('/api/auth/sign-up', async ({ request }) => {
    await delay(400);
    const state = getAuthState();
    if (!state.loggedIn) return fail(401, '로그인이 필요합니다.');

    const body = (await request.json()) as { agrees?: string[][]; nickname?: string };
    const agreedCodes = new Set((body.agrees ?? []).map((pair) => pair[0]));
    const requiredOk = TERMS.filter((t) => t.required).every((t) => agreedCodes.has(t.code));
    if (!requiredOk) return fail(400, '필수 약관에 모두 동의하지 않았습니다.');

    const nickname = body.nickname ?? '';
    if (
      nickname.length < NICKNAME_MIN ||
      nickname.length > NICKNAME_MAX ||
      !NICKNAME_PATTERN.test(nickname)
    ) {
      return fail(400, '닉네임 형식이 올바르지 않습니다.');
    }

    setAuthState({ loggedIn: true, nickname });
    return HttpResponse.json({ code: 200, message: '가입에 성공했습니다.', data: null });
  }),

  // ── 민원 (17-x — 백엔드 API 미정, 임시 스키마) ─────────────────────
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

  // ── 대여소 ─────────────────────────────────────────────────────────
  // 07 메인 지도용. 도보 시간은 프론트에서 좌표로 계산하므로 내려주지 않는다.
  http.get('/api/map/bike-station', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    // 갱신 배지가 "N초 전"부터 올라가는 것을 확인할 수 있게 10초 전으로 고정
    const updatedAt = new Date(Date.now() - 10_000).toISOString();
    const stations: BikeStation[] = STATIONS.map((s) => ({ ...s, updatedAt }));
    return HttpResponse.json(ok(stations));
  }),

  // 공통 기반 확인용으로 만든 엔드포인트 — 대여소 마커 이슈에서 /map/bike-station으로 합치고 제거할 것
  http.get('/api/stations', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    return HttpResponse.json(ok(STATIONS));
  }),

  http.get('/api/stations/:stationId/predictions', async ({ params }) => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const station = STATIONS.find((s) => s.stationId === params.stationId);
    if (!station) {
      return HttpResponse.json(
        { code: 404, message: '대여소를 찾을 수 없습니다.', data: null },
        { status: 404 },
      );
    }
    // 지평이 길수록 잔여가 조금씩 줄어드는 단순 목업
    const predictions: StationPrediction[] = PREDICTION_HORIZONS.map((horizonMin, i) => {
      const bikes = Math.max(0, station.currentBikes - i);
      return {
        stationId: station.stationId,
        horizonMin,
        bikes,
        probOut: bikes === 0 ? 0.9 : bikes < 3 ? 0.3 : 0.05,
        updatedAt: new Date().toISOString(),
      };
    });
    return HttpResponse.json(ok(predictions));
  }),
];
