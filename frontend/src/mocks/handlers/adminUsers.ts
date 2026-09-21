import { delay, http, HttpResponse } from 'msw';
import { fail, isAdminLoggedIn, MOCK_ADMIN, ok } from '@/mocks/core';
import { STATIONS } from '@/mocks/stations';

/**
 * 관리자 사용자 목업 — 사용자 30명은 결정적으로 생성하고,
 * 밴 기록만 저장소(user_ban_records 흉내)에 둔다. 상태(NORMAL/BANNED)는
 * 백엔드처럼 "유효한 밴 기록이 있는가"에서 파생한다.
 *
 * 시각은 백엔드 LocalDateTime과 같게 오프셋 없는 문자열("2026-09-01T14:32:00")로 준다.
 */
const ADMIN_USER_BANS_KEY = 'msw_admin_user_bans_v2';
const ADMIN_USER_COUNT = 30;

/** Date → "2026-09-01T14:32:00" (백엔드 LocalDateTime 직렬화와 동일) */
function localDateTime(at: number | Date): string {
  const d = at instanceof Date ? at : new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

interface MockBanRecord {
  banId: number;
  userId: number;
  startedAt: string;
  scheduledEndAt: string;
  releasedAt: string | null;
  comment: string | null;
  adminId: number;
}

const USER_NICKNAME_POOL = [
  '달리는거북', '바퀴요정', '자전거덕후', '탄방동주민', '출근라이더',
  '둔산질주', '갑천산책러', '유성불주먹', '주말라이더', '한밭바람',
];

/** adminCycles(이용 이력의 이용자 표시)도 같은 닉네임을 쓴다 */
export function mockUserNickname(userId: number): string {
  const base = USER_NICKNAME_POOL[userId % USER_NICKNAME_POOL.length];
  return userId <= USER_NICKNAME_POOL.length ? base : `${base}${userId}`;
}

/** 자전거 ID 체계는 adminCycles와 같다 (DJ-1XXXX) */
function mockCycleId(index: number): string {
  return `DJ-1${String(index).padStart(4, '0')}`;
}

function seedUserBans(): MockBanRecord[] {
  const day = 24 * 3600_000;
  return [
    // 진행 중인 제재 — 목록에서 BANNED로 보이게
    {
      banId: 3,
      userId: 7,
      startedAt: localDateTime(Date.now() - 2 * day),
      scheduledEndAt: localDateTime(Date.now() + 5 * day),
      releasedAt: null,
      comment: '허위 제보 반복 등록',
      adminId: MOCK_ADMIN.adminId,
    },
    // 기간을 모두 채우고 끝난 제재
    {
      banId: 2,
      userId: 7,
      startedAt: localDateTime(Date.now() - 102 * day),
      scheduledEndAt: localDateTime(Date.now() - 99 * day),
      releasedAt: null,
      comment: '자전거 파손 후 미신고',
      adminId: MOCK_ADMIN.adminId,
    },
    // 조기 해제된 제재 — 종료일이 예정일보다 앞선다
    {
      banId: 1,
      userId: 7,
      startedAt: localDateTime(Date.now() - 170 * day),
      scheduledEndAt: localDateTime(Date.now() - 140 * day),
      releasedAt: localDateTime(Date.now() - 155 * day),
      comment: '타인 계정 대여 시도',
      adminId: MOCK_ADMIN.adminId,
    },
  ];
}

function getMockUserBans(): MockBanRecord[] {
  try {
    const raw = localStorage.getItem(ADMIN_USER_BANS_KEY);
    if (raw) return JSON.parse(raw) as MockBanRecord[];
  } catch {
    // 파싱 실패 시 시드로 초기화
  }
  const seeded = seedUserBans();
  setMockUserBans(seeded);
  return seeded;
}

function setMockUserBans(records: MockBanRecord[]) {
  try {
    localStorage.setItem(ADMIN_USER_BANS_KEY, JSON.stringify(records));
  } catch {
    // 저장 불가 환경 무시
  }
}

/** 백엔드 findFirstBy…ReleasedAtIsNullAndScheduledEndAtAfter(now)와 같은 판정 */
function activeBanOf(userId: number): MockBanRecord | null {
  const now = Date.now();
  return (
    getMockUserBans().find(
      (b) =>
        b.userId === userId && b.releasedAt === null && new Date(b.scheduledEndAt).getTime() > now,
    ) ?? null
  );
}

/** 최근 대여 시각 — 이용 기록의 첫 행과 같은 값이어야 한다 */
function recentUsingAt(userId: number): string {
  return localDateTime(Date.now() - ((userId * 131) % 4000) * 60_000);
}

/** 목록 응답 (AdminUserListResponse 실측 — userId·nickname·recentUsingAt·userStatement) */
function mockUserSummary(userId: number) {
  return {
    userId,
    nickname: mockUserNickname(userId),
    recentUsingAt: recentUsingAt(userId),
    userStatement: activeBanOf(userId) ? 'BANNED' : 'NORMAL',
  };
}

/**
 * 경로 기록 (AdminUserPathHistoryResponse.PathInfo 실측).
 * totalDuration은 도보를 포함한 전체 경로 시간, cycleDuration은 자전거 탑승 시간이라
 * 언제나 totalDuration ≥ cycleDuration이다.
 */
function mockUserPaths(userId: number) {
  const first = new Date(recentUsingAt(userId)).getTime();
  return Array.from({ length: 24 }, (_, j) => {
    const cycleDuration = 7 + ((userId + j * 7) % 26);
    const walk = 5 + ((userId + j * 3) % 9);
    const usingAt = j === 0 ? first : first - (j * 31 + userId * 3) * 3600_000;
    return {
      usingAt: localDateTime(usingAt),
      startingPoint: STATIONS[(userId + j) % STATIONS.length].name,
      endPoint: STATIONS[(userId + j * 5 + 2) % STATIONS.length].name,
      cycleId: mockCycleId(((userId * 7 + j * 11) % 90) + 1),
      totalDuration: cycleDuration + walk,
      cycleDuration,
    };
  });
}

/** 경로 한 건의 거리(m) — 자전거 평균 13km/h + 도보 5km/h로 환산 */
function mockPathDistance(path: { totalDuration: number; cycleDuration: number }): number {
  const walkMin = path.totalDuration - path.cycleDuration;
  return Math.round((path.cycleDuration * 13_000 + walkMin * 5_000) / 60);
}

/**
 * 관리자 사용자 관리 (04·09 — AdminController/AdminUserService 실측 스키마).
 * 고정 경로(list)는 :userId 핸들러보다 먼저 등록한다
 */
export const adminUserHandlers = [
  http.get('/api/admin/user/list', async ({ request }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const url = new URL(request.url);
    const statement = url.searchParams.get('statement') ?? '';
    const order = url.searchParams.get('order') ?? 'newest';
    if (statement && statement !== 'NORMAL' && statement !== 'BANNED') {
      return fail(400, 'statement는 BANNED 또는 NORMAL만 가능합니다.');
    }
    if (order !== 'newest' && order !== 'oldest') {
      return fail(400, 'order는 newest 또는 oldest만 가능합니다.');
    }
    let users = Array.from({ length: ADMIN_USER_COUNT }, (_, i) => mockUserSummary(i + 1));
    if (statement) users = users.filter((u) => u.userStatement === statement);
    users.sort((a, b) =>
      order === 'oldest'
        ? a.recentUsingAt.localeCompare(b.recentUsingAt)
        : b.recentUsingAt.localeCompare(a.recentUsingAt),
    );
    return HttpResponse.json(ok(users));
  }),

  http.post('/api/admin/user/:userId/ban', async ({ params, request }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const userId = Number(params.userId);
    if (userId < 1 || userId > ADMIN_USER_COUNT) return fail(404, '존재하지 않는 사용자입니다.');
    const body = (await request.json()) as { scheduledEndAt?: string; comment?: string };
    // 백엔드 @NotNull @Future 검증과 동일 (LocalDateTime이라 오프셋이 붙으면 파싱 실패)
    if (!body.scheduledEndAt || /[Zz]|[+-]\d\d:\d\d$/.test(body.scheduledEndAt)) {
      return fail(400, '제재 종료 시각 형식이 올바르지 않습니다.');
    }
    if (new Date(body.scheduledEndAt).getTime() <= Date.now()) {
      return fail(400, '제재 종료 시각은 미래여야 합니다.');
    }
    if ((body.comment ?? '').length > 100) return fail(400, '사유는 100자 이내여야 합니다.');
    if (activeBanOf(userId)) return fail(409, '이미 제재 중인 사용자입니다.');
    const records = getMockUserBans();
    records.unshift({
      banId: Math.max(0, ...records.map((r) => r.banId)) + 1,
      userId,
      startedAt: localDateTime(Date.now()),
      scheduledEndAt: body.scheduledEndAt,
      releasedAt: null,
      comment: body.comment?.trim() || null,
      adminId: MOCK_ADMIN.adminId,
    });
    setMockUserBans(records);
    return HttpResponse.json(ok(null));
  }),

  // 밴 해제 — 실서버처럼 사용자가 아니라 밴 기록(banRecordId) 기준
  http.post('/api/admin/user/ban/:banRecordId/release', async ({ params }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const records = getMockUserBans();
    const record = records.find((b) => b.banId === Number(params.banRecordId));
    if (!record) return fail(404, '사용자 제재 기록이 없습니다.');
    // 백엔드 releaseActiveBan — 이미 끝났거나 해제된 기록은 409
    if (record.releasedAt !== null || new Date(record.scheduledEndAt).getTime() <= Date.now()) {
      return fail(409, '현재 유효한 제재 기록이 아닙니다.');
    }
    record.releasedAt = localDateTime(Date.now());
    setMockUserBans(records);
    return HttpResponse.json(ok(null));
  }),

  // 밴 이력 전체 (AdminUserBanHistoryResponse 리스트) — 기록이 없으면 빈 배열
  http.get('/api/admin/user/:userId/ban', async ({ params }) => {
    await delay(300);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const userId = Number(params.userId);
    if (userId < 1 || userId > ADMIN_USER_COUNT) return fail(404, '존재하지 않는 사용자입니다.');
    const history = getMockUserBans()
      .filter((b) => b.userId === userId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.banId - a.banId)
      .map((ban) => {
        // 조기 해제됐으면 해제 시각이 종료 시각이다 (백엔드 toBanHistoryResponse와 동일)
        const scheduledEnd = new Date(ban.scheduledEndAt).getTime();
        const released = ban.releasedAt ? new Date(ban.releasedAt).getTime() : null;
        return {
          banRecordId: ban.banId,
          banStartedAt: ban.startedAt,
          banEndAt: released !== null && released < scheduledEnd ? ban.releasedAt : ban.scheduledEndAt,
          period: Math.floor((scheduledEnd - new Date(ban.startedAt).getTime()) / (24 * 3600_000)),
          comment: ban.comment,
          adminId: ban.adminId,
        };
      });
    return HttpResponse.json(ok(history));
  }),

  // 경로 기록 (AdminUserPathHistoryResponse) — 이용 기록 탭
  http.get('/api/admin/user/:userId/path', async ({ params }) => {
    await delay(350);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const userId = Number(params.userId);
    if (Number.isNaN(userId) || userId < 1 || userId > ADMIN_USER_COUNT) {
      return fail(404, '존재하지 않는 사용자입니다.');
    }
    const pathsList = mockUserPaths(userId);
    return HttpResponse.json(
      ok({
        totalUsingDistance: pathsList.reduce((sum, p) => sum + mockPathDistance(p), 0),
        pathsList,
      }),
    );
  }),

  // 상세 (AdminUserDetailResponse) — userId·상태는 응답에 없다
  http.get('/api/admin/user/:userId', async ({ params }) => {
    await delay(350);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const userId = Number(params.userId);
    if (Number.isNaN(userId) || userId < 1 || userId > ADMIN_USER_COUNT) {
      return fail(404, '존재하지 않는 사용자입니다.');
    }
    const paths = mockUserPaths(userId);
    return HttpResponse.json(
      ok({
        nickname: mockUserNickname(userId),
        createdAt: localDateTime(Date.now() - (200 + userId * 9) * 24 * 3600_000),
        recentUsingAt: recentUsingAt(userId),
        // 표에 보이는 경로보다 실제 대여 횟수가 많은 사용자를 흉내 낸다
        totalUsingCnt: paths.length + ((userId * 11) % 60),
        totalUsingTime: paths.reduce((sum, p) => sum + p.cycleDuration, 0),
      }),
    );
  }),
];
