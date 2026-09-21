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

/** 공지사항 — 목록·상세는 NoticeController 실측 스키마, 등록·삭제는 백엔드 구현 X라 목업 기준 */
export const adminNoticeHandlers = [
  http.get('/api/notice/list', async () => {
    await delay(300);
    if (!anyLoggedIn()) return fail(401, '로그인이 필요합니다.');
    // NoticeListResponse — 본문(content)은 목록에 없다
    const notices = [...getMockNotices()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ noticeId, title, author, createdAt }) => ({ noticeId, title, author, createdAt }));
    return HttpResponse.json(ok(notices));
  }),

  http.get('/api/notice/:noticeId', async ({ params }) => {
    await delay(250);
    if (!anyLoggedIn()) return fail(401, '로그인이 필요합니다.');
    const notice = getMockNotices().find((n) => n.noticeId === Number(params.noticeId));
    if (!notice) return fail(404, '존재하지 않는 공지입니다.');
    // NoticeDetailResponse — noticeId 없이 온다
    return HttpResponse.json(
      ok({
        title: notice.title,
        author: notice.author,
        createdAt: notice.createdAt,
        content: notice.content,
      }),
    );
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
];
