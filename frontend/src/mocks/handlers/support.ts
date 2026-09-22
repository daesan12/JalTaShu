import { delay, http, HttpResponse } from 'msw';
import { ok, requireAuth, fail } from '@/mocks/core';

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

  // ── 공지 팝업 (07-1 — 백엔드 PopupListResponse 실측) ──────────────
  // 공지사항 목록과는 별개 데이터. 관리자가 팝업을 따로 등록하며, 등록할 때 공지 하나를
  // 반드시 연결한다(PopupEntity.notice가 not null) — 그래서 모든 팝업이 누를 수 있다.
  http.get('/api/notice/pop-up', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    return HttpResponse.json(
      ok([
        { popupId: 5, title: '임시 폐쇄 대여소 안내', photoUrl: '/notices/notice-01-temporary-closure.jpg', noticeId: 5 },
        { popupId: 4, title: '공공 데이터 활용 설문조사', photoUrl: '/notices/notice-02-public-data-survey.jpg', noticeId: 4 },
        { popupId: 3, title: '이용약관 개정 알림', photoUrl: '/notices/notice-03-terms-update.jpg', noticeId: 3 },
        { popupId: 2, title: '안전수칙 확인 절차 개선', photoUrl: '/notices/notice-04-safety-check.jpg', noticeId: 2 },
        { popupId: 1, title: '대여소 반납 안내', photoUrl: '/notices/notice-05-return-check.jpg', noticeId: 1 },
      ]),
    );
  }),
];
