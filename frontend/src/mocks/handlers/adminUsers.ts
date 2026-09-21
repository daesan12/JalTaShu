import { delay, http, HttpResponse } from 'msw';
import { fail, isAdminLoggedIn, MOCK_ADMIN, ok } from '@/mocks/core';
import { STATIONS } from '@/mocks/stations';

/**
 * 관리자 사용자 목업 — 사용자 30명은 결정적으로 생성하고,
 * 밴 기록만 저장소(user_ban_records 흉내)에 둔다. 상태(NORMAL/BANNED)는
 * 백엔드처럼 "유효한 밴 기록이 있는가"에서 파생한다.
 */
const ADMIN_USER_BANS_KEY = 'msw_admin_user_bans';
const ADMIN_USER_COUNT = 30;

interface MockBanRecord {
  banId: number;
  userId: number;
  startedAt: string;
  scheduledEndAt: string;
  releasedAt: string | null;
  comment: string | null;
  adminName: string;
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

function seedUserBans(): MockBanRecord[] {
  const day = 24 * 3600_000;
  return [
    // 진행 중인 제재 — 목록에서 BANNED로 보이게
    {
      banId: 2,
      userId: 7,
      startedAt: new Date(Date.now() - 2 * day).toISOString(),
      scheduledEndAt: new Date(Date.now() + 5 * day).toISOString(),
      releasedAt: null,
      comment: '허위 제보 반복 접수 (3회)',
      adminName: '운영관리자',
    },
    // 해제된 과거 제재 — 밴 이력 탭에서 이력 예시로
    {
      banId: 1,
      userId: 7,
      startedAt: new Date(Date.now() - 40 * day).toISOString(),
      scheduledEndAt: new Date(Date.now() - 33 * day).toISOString(),
      releasedAt: new Date(Date.now() - 35 * day).toISOString(),
      comment: '방치 신고 허위 작성',
      adminName: '운영관리자',
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

/** 목록 응답 — 실서버처럼 닉네임 없이 준다 (닉네임 추가는 백엔드 전달 목록) */
function mockUserSummary(userId: number) {
  return {
    userId,
    recentUsingAt: new Date(Date.now() - ((userId * 131) % 4000) * 60_000).toISOString(),
    userStatement: activeBanOf(userId) ? 'BANNED' : 'NORMAL',
  };
}

function mockUserRides(userId: number) {
  return Array.from({ length: 8 }, (_, j) => {
    const durationMin = 7 + ((userId + j * 7) % 38);
    const end = Date.now() - (j * 31 + userId * 3) * 3600_000;
    return {
      rideId: userId * 1000 + j,
      startAt: new Date(end - durationMin * 60_000).toISOString(),
      endAt: new Date(end).toISOString(),
      fromStation: STATIONS[(userId + j) % STATIONS.length].name,
      toStation: STATIONS[(userId + j * 5 + 2) % STATIONS.length].name,
      durationMin,
      distanceKm: Number((durationMin * 0.19).toFixed(1)),
    };
  });
}

/**
 * 관리자 사용자 관리 (04·09 — 목록·밴·해제 구현 O(실측 스키마), 상세·이력 미구현).
 * 고정 경로(list)는 :userId 핸들러보다 먼저 등록한다
 */
export const adminUserHandlers = [
  http.get('/api/admin/user/list', async ({ request }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const url = new URL(request.url);
    const statement = url.searchParams.get('statement') ?? '';
    const order = url.searchParams.get('order') ?? 'newest';
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
    // 백엔드 @NotNull @Future 검증과 동일
    if (!body.scheduledEndAt || new Date(body.scheduledEndAt).getTime() <= Date.now()) {
      return fail(400, '제재 종료 시각은 미래여야 합니다.');
    }
    if ((body.comment ?? '').length > 100) return fail(400, '사유는 100자 이내여야 합니다.');
    if (activeBanOf(userId)) return fail(409, '이미 제재 중인 사용자입니다.');
    const records = getMockUserBans();
    records.unshift({
      banId: Math.max(0, ...records.map((r) => r.banId)) + 1,
      userId,
      startedAt: new Date().toISOString(),
      scheduledEndAt: body.scheduledEndAt,
      releasedAt: null,
      comment: body.comment?.trim() || null,
      adminName: MOCK_ADMIN.name,
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
    if (!record) return fail(404, '존재하지 않는 밴 기록입니다.');
    if (record.releasedAt === null) record.releasedAt = new Date().toISOString();
    setMockUserBans(records);
    return HttpResponse.json(ok(null));
  }),

  // 최신 밴 기록 1건 (AdminUserBanHistoryResponse 실측) — 기록이 없으면 404
  http.get('/api/admin/user/:userId/ban', async ({ params }) => {
    await delay(300);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const userId = Number(params.userId);
    if (userId < 1 || userId > ADMIN_USER_COUNT) return fail(404, '존재하지 않는 사용자입니다.');
    const latest = getMockUserBans()
      .filter((b) => b.userId === userId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (!latest) return fail(404, '밴 기록이 없습니다.');
    // 조기 해제됐으면 해제 시각이 종료 시각이다 (백엔드 getUserBanHistory와 동일)
    const scheduledEnd = new Date(latest.scheduledEndAt).getTime();
    const released = latest.releasedAt ? new Date(latest.releasedAt).getTime() : null;
    const banEndAt =
      released !== null && released < scheduledEnd ? latest.releasedAt : latest.scheduledEndAt;
    const period = Math.round(
      (scheduledEnd - new Date(latest.startedAt).getTime()) / (24 * 3600_000),
    );
    return HttpResponse.json(
      ok({
        banRecordId: latest.banId,
        banStartedAt: latest.startedAt,
        banEndAt,
        period,
        comment: latest.comment,
        adminId: 1,
      }),
    );
  }),

  http.get('/api/admin/user/:userId', async ({ params }) => {
    await delay(350);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const userId = Number(params.userId);
    if (Number.isNaN(userId) || userId < 1 || userId > ADMIN_USER_COUNT) {
      return fail(404, '존재하지 않는 사용자입니다.');
    }
    const active = activeBanOf(userId);
    return HttpResponse.json(
      ok({
        ...mockUserSummary(userId),
        nickname: mockUserNickname(userId),
        joinedAt: new Date(Date.now() - (200 + userId * 9) * 24 * 3600_000).toISOString(),
        activeBan: active
          ? { scheduledEndAt: active.scheduledEndAt, comment: active.comment }
          : null,
        totalRides: 12 + ((userId * 11) % 120),
        totalDistanceKm: Number((30 + ((userId * 17) % 260)).toFixed(1)),
        totalDurationMin: 240 + ((userId * 53) % 1800),
        rides: mockUserRides(userId),
      }),
    );
  }),
];
