import { delay, http, HttpResponse } from 'msw';
import type { ApiResponse, Station, StationPrediction } from '@/shared/api/types';
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

  // ── 대여소 ─────────────────────────────────────────────────────────
  http.get('/api/stations', async () => {
    await delay(300);
    return HttpResponse.json(ok(STATIONS));
  }),

  http.get('/api/stations/:stationId/predictions', async ({ params }) => {
    await delay(300);
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
