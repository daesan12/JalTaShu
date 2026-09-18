import { delay, http, HttpResponse } from 'msw';
import { ok, requireAuth, fail } from '@/mocks/core';

/** 공지 팝업 목업 이미지 — 실제 이미지가 없어 색·번호만 있는 SVG를 data URI로 만든다 */
function placeholderImage(label: string, color: string): string {
  // Figma 공지 이미지 크기(283 x 276)와 같은 비율
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="566" height="552"><rect width="566" height="552" fill="${color}"/><text x="283" y="296" font-family="sans-serif" font-size="52" fill="#ffffff" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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

/** 회원 탈퇴(auth)에서도 비운다 */
export function setOpenApiRequests(requests: MockOpenApiRequest[]) {
  try {
    localStorage.setItem(OPEN_API_KEY, JSON.stringify(requests));
  } catch {
    // 저장 불가 환경 무시
  }
}

/**
 * 고객센터·자전거 정보 (공지 팝업·Open API 신청).
 * 공지 목록·상세는 실서버와 같이 /api/notice/* (adminNotices 핸들러)를 쓴다.
 */
export const supportHandlers = [
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

  // ── 공지 팝업 (07-1 — 백엔드 API 미정, 임시 스키마) ───────────────
  // 공지사항 목록과는 별개 데이터. 관리자 페이지에서 따로 CRUD하고, 등록 시 공지사항 하나를
  // 연결할 수 있다(linkedNoticeId). 연결하지 않은 팝업은 눌러도 이동하지 않는다.
  http.get('/api/notice-popups', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    return HttpResponse.json(
      ok([
        { id: 1, imageUrl: placeholderImage('공지 1', '#4c8a12'), linkedNoticeId: 5 },
        { id: 2, imageUrl: placeholderImage('공지 2', '#3c6e0e'), linkedNoticeId: null },
        { id: 3, imageUrl: placeholderImage('공지 3', '#f59e0b'), linkedNoticeId: 4 },
        { id: 4, imageUrl: placeholderImage('공지 4', '#0ea5e9'), linkedNoticeId: null },
        { id: 5, imageUrl: placeholderImage('공지 5', '#7c3aed'), linkedNoticeId: 3 },
      ]),
    );
  }),
];
