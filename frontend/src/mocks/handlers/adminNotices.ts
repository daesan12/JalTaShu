import { delay, http, HttpResponse } from 'msw';
import { fail, getAuthState, isAdminLoggedIn, ok } from '@/mocks/core';

/**
 * 공지사항 저장소 — 관리자(06·08)가 CRUD하고, 모바일 고객센터도 같은 목록/상세 API를 읽는다
 * (NoticeController는 관리자 전용이 아니다 — 로그인한 누구나 조회 가능).
 */
const ADMIN_NOTICES_KEY = 'msw_admin_notices';

export interface MockNotice {
  noticeId: number;
  title: string;
  author: string;
  content: string;
  createdAt: string;
}

const ADMIN_POPUPS_KEY = 'msw_admin_popups';

/** 팝업 한 건 — 백엔드 PopupListResponse 실측(popupId 포함, 이슈 #128) */
export interface MockPopup {
  popupId: number;
  title: string;
  photoUrl: string;
  noticeId: number;
}

/**
 * 기본 팝업 5장 — 앱 번들 이미지와 같은 것을 가리킨다.
 * noticeId 1~5는 seed 공지(V3 마이그레이션)와 같은 번호다.
 */
const SEED_POPUPS: MockPopup[] = [
  { popupId: 5, title: '임시 폐쇄 대여소 안내', photoUrl: '/notices/notice-01-temporary-closure.jpg', noticeId: 5 },
  { popupId: 4, title: '공공 데이터 활용 설문조사', photoUrl: '/notices/notice-02-public-data-survey.jpg', noticeId: 4 },
  { popupId: 3, title: '이용약관 개정 알림', photoUrl: '/notices/notice-03-terms-update.jpg', noticeId: 3 },
  { popupId: 2, title: '안전수칙 확인 절차 개선', photoUrl: '/notices/notice-04-safety-check.jpg', noticeId: 2 },
  { popupId: 1, title: '대여소 반납 안내', photoUrl: '/notices/notice-05-return-check.jpg', noticeId: 1 },
];

export function getMockPopups(): MockPopup[] {
  try {
    const raw = localStorage.getItem(ADMIN_POPUPS_KEY);
    if (raw) return JSON.parse(raw) as MockPopup[];
  } catch {
    // 저장소를 못 읽으면 기본값으로 돈다
  }
  return [...SEED_POPUPS];
}

function setMockPopups(popups: MockPopup[]): void {
  try {
    localStorage.setItem(ADMIN_POPUPS_KEY, JSON.stringify(popups));
  } catch {
    // 저장 실패는 무시한다 — 다음 새로고침에 기본값으로 돌아간다
  }
}

/** 실서버 기준: 이용자든 관리자든 로그인돼 있으면 조회 가능 */
function anyLoggedIn(): boolean {
  return isAdminLoggedIn() || getAuthState().loggedIn;
}

const NOTICE_SEED_CONTENT =
  '안녕하세요, 대전광역시 공영자전거 타슈입니다.\n\n자세한 내용은 본문을 확인해 주세요. 이용에 참고 부탁드립니다.\n\n감사합니다.';

function seedNotices(): MockNotice[] {
  const seeded: MockNotice[] = [
    { noticeId: 5, title: '임시 폐쇄 대여소 안내 (2026. 9. 10.)', createdAt: '2026-09-10T09:00:00+09:00' },
    { noticeId: 4, title: '♣2026년 공공 데이터 활용 설문조사 실시', createdAt: '2026-08-25T09:00:00+09:00' },
    { noticeId: 3, title: '공영자전거 타슈 이용약관 개정 알림', createdAt: '2026-04-10T09:00:00+09:00' },
    { noticeId: 2, title: '"타슈" 대여 전 안전수칙 확인 후 대여하도록 절차 개선', createdAt: '2025-10-28T09:00:00+09:00' },
    { noticeId: 1, title: '타슈 대여소에 반드시 반납해주세요!!!', createdAt: '2023-08-02T09:00:00+09:00' },
  ].map((n) => ({ ...n, author: '타슈 운영팀', content: NOTICE_SEED_CONTENT }));
  // 관리자 목록 페이지네이션 확인용 — 월별 점검 공지를 채워 2페이지 이상 만든다 (12월→1월)
  for (let i = 0; i < 12; i++) {
    const month = 12 - i;
    seeded.push({
      noticeId: 6 + i,
      title: `대여소 정기 점검 안내 (2025년 ${month}월)`,
      author: '타슈 운영팀',
      content: NOTICE_SEED_CONTENT,
      createdAt: `2025-${String(month).padStart(2, '0')}-03T09:00:00+09:00`,
    });
  }
  return seeded;
}

/** 모바일 공지 목록(support)도 이 저장소를 읽는다 */
export function getMockNotices(): MockNotice[] {
  try {
    const raw = localStorage.getItem(ADMIN_NOTICES_KEY);
    if (raw) return JSON.parse(raw) as MockNotice[];
  } catch {
    // 파싱 실패 시 시드로 초기화
  }
  const seeded = seedNotices();
  setMockNotices(seeded);
  return seeded;
}

function setMockNotices(notices: MockNotice[]) {
  try {
    localStorage.setItem(ADMIN_NOTICES_KEY, JSON.stringify(notices));
  } catch {
    // 저장 불가 환경 무시
  }
}

/** NoticeListResponse — 본문(content)은 목록에 없다 */
function noticeList() {
  return [...getMockNotices()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ noticeId, title, author, createdAt }) => ({ noticeId, title, author, createdAt }));
}

/**
 * AdminNoticeListResponse — 관리자 목록에만 연결된 팝업 ID를 포함한다.
 * 팝업 저장소를 보고 채우므로 관리자 화면에서 핀을 켜고 끄면 다음 조회에 그대로 나타난다.
 */
function adminNoticeList() {
  const popups = getMockPopups();
  return noticeList().map((notice) => ({
    ...notice,
    popupId: popups.find((popup) => popup.noticeId === notice.noticeId)?.popupId ?? null,
  }));
}

/** NoticeDetailResponse — noticeId 없이 온다 */
function noticeDetail({ title, author, createdAt, content }: MockNotice) {
  return { title, author, createdAt, content };
}

/** 공지사항 — 목록·상세는 실측 스키마, 등록·삭제는 백엔드 구현 X라 목업 기준 */
export const adminNoticeHandlers = [
  // 관리자 목록 (AdminNoticeController) — 응답은 /notice/list와 같고 관리자 토큰만 받는다
  http.get('/api/admin/notice/list', async () => {
    await delay(300);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    return HttpResponse.json(ok(adminNoticeList()));
  }),

  // 관리자 상세 (AdminNoticeController) — :noticeId 핸들러라 반드시 /list 뒤에 온다
  http.get('/api/admin/notice/:noticeId', async ({ params }) => {
    await delay(250);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const notice = getMockNotices().find((n) => n.noticeId === Number(params.noticeId));
    if (!notice) return fail(404, '존재하지 않는 공지입니다.');
    return HttpResponse.json(ok(noticeDetail(notice)));
  }),

  // 모바일 고객센터 목록 (NoticeController) — 로그인한 이용자면 조회 가능
  http.get('/api/notice/list', async () => {
    await delay(300);
    if (!anyLoggedIn()) return fail(401, '로그인이 필요합니다.');
    return HttpResponse.json(ok(noticeList()));
  }),

  http.get('/api/notice/:noticeId', async ({ params }) => {
    await delay(250);
    if (!anyLoggedIn()) return fail(401, '로그인이 필요합니다.');
    const notice = getMockNotices().find((n) => n.noticeId === Number(params.noticeId));
    if (!notice) return fail(404, '존재하지 않는 공지입니다.');
    return HttpResponse.json(ok(noticeDetail(notice)));
  }),

  http.post('/api/admin/notice', async ({ request }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const body = (await request.json()) as { title?: string; content?: string };
    const title = body.title?.trim() ?? '';
    const content = body.content?.trim() ?? '';
    if (!title || !content) return fail(400, '제목과 내용을 입력해 주세요.');
    if (title.length > 60 || content.length > 2000) {
      return fail(400, '제목 60자, 내용 2000자를 넘을 수 없습니다.');
    }
    const notices = getMockNotices();
    const notice: MockNotice = {
      noticeId: Math.max(0, ...notices.map((n) => n.noticeId)) + 1,
      title,
      author: '타슈 운영팀',
      content,
      createdAt: new Date().toISOString(),
    };
    notices.unshift(notice);
    setMockNotices(notices);
    return HttpResponse.json(ok(notice));
  }),

  http.delete('/api/admin/notice/:noticeId', async ({ params }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const notices = getMockNotices();
    const noticeId = Number(params.noticeId);
    if (!notices.some((n) => n.noticeId === noticeId)) {
      return fail(404, '존재하지 않는 공지입니다.');
    }
    setMockNotices(notices.filter((n) => n.noticeId !== noticeId));
    return HttpResponse.json(ok(null));
  }),

  /** GET /admin/pop-up — 관리자 전용 팝업 목록(이슈 #128). 앱용 `/notice/pop-up`과 같은 저장소다 */
  http.get('/api/admin/pop-up', async () => {
    await delay(300);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    return HttpResponse.json(ok(getMockPopups()));
  }),

  /*
   * 팝업 고정(핀) — 백엔드는 multipart로 title·photo·noticeId를 받는다.
   * 목업은 파일을 S3에 올릴 수 없으므로 **업로드한 이미지는 무시하고** 연결된 공지 번호로
   * 번들 이미지 하나를 골라 준다. 화면 흐름(등록 → 목록 갱신 → 팝업 노출)만 확인하는 용도다.
   */
  http.post('/api/admin/pop-up', async ({ request }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const form = await request.formData();
    const title = String(form.get('title') ?? '').trim();
    const noticeId = Number(form.get('noticeId'));
    if (!title || title.length > 255) return fail(400, '팝업 제목은 1~255자로 입력해주세요.');
    if (!form.get('photo')) return fail(400, '팝업 이미지를 올려주세요.');
    if (!getMockNotices().some((n) => n.noticeId === noticeId)) {
      return fail(404, '존재하지 않는 공지입니다.');
    }
    const popups = getMockPopups();
    if (popups.some((p) => p.noticeId === noticeId)) {
      return fail(400, '이미 팝업으로 고정된 공지입니다.');
    }
    const popup: MockPopup = {
      popupId: Math.max(0, ...popups.map((p) => p.popupId)) + 1,
      title,
      // 올린 파일 대신 번들 이미지를 돌려 쓴다 — 목업에는 저장할 곳이 없다
      photoUrl: SEED_POPUPS[popups.length % SEED_POPUPS.length].photoUrl,
      noticeId,
    };
    setMockPopups([popup, ...popups]);
    return HttpResponse.json(ok({ popupId: popup.popupId }));
  }),

  /*
   * 팝업 수정 — 백엔드 `updatePopup`처럼 title·photo·noticeId가 전부 선택값이다(#146).
   * 목업은 파일을 저장할 곳이 없어 사진이 오면 **다음 번들 이미지로 바꿔** 교체가 화면에 보이게 한다.
   */
  http.patch('/api/admin/pop-up/:popupId', async ({ params, request }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const popups = getMockPopups();
    const popupId = Number(params.popupId);
    const target = popups.find((p) => p.popupId === popupId);
    if (target === undefined) return fail(404, '존재하지 않는 팝업입니다.');
    const form = await request.formData();
    const title = form.get('title');
    const next: MockPopup = { ...target };
    if (typeof title === 'string' && title.trim()) next.title = title.trim();
    if (form.get('photo')) {
      const index = SEED_POPUPS.findIndex((p) => p.photoUrl === target.photoUrl);
      next.photoUrl = SEED_POPUPS[(index + 1) % SEED_POPUPS.length].photoUrl;
    }
    setMockPopups(popups.map((p) => (p.popupId === popupId ? next : p)));
    return HttpResponse.json(ok({ popupId }));
  }),

  http.delete('/api/admin/pop-up/:popupId', async ({ params }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const popups = getMockPopups();
    const popupId = Number(params.popupId);
    if (!popups.some((p) => p.popupId === popupId)) {
      return fail(404, '존재하지 않는 팝업입니다.');
    }
    setMockPopups(popups.filter((p) => p.popupId !== popupId));
    return HttpResponse.json(ok(null));
  }),
];
