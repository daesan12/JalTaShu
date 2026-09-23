import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '@/mocks/handlers';
import { toUsagePath } from '@/features/map/lib/usagePath';

/**
 * 도메인별로 쪼갠 핸들러가 하나의 배열로 합쳐져도 동작하는지 확인하는 스모크 테스트.
 * 특히 고정 경로(admin/claim/list, station/trend, cycle/list)가 :param 핸들러에
 * 잡아먹히지 않는 "배럴 등록 순서"를 지키는 안전망이다.
 */

// 핸들러 저장소가 localStorage를 쓰는데 vitest 기본 환경(node)에는 없다 — 최소 구현으로 대체
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
});
// '/api/…' 같은 상대 경로 핸들러는 location.origin 기준으로 매칭된다 — node에는 location이 없어 채워 준다
vi.stubGlobal('location', new URL('http://localhost/'));

const server = setupServer(...handlers);

// 상대 경로 핸들러는 아무 origin에나 붙는다 — node fetch는 절대 URL이 필요해 붙여 준다
const get = (path: string) => fetch(`http://localhost${path}`);
const post = (path: string, body?: unknown) =>
  fetch(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
  });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => store.clear());
afterAll(() => server.close());

async function adminLogin() {
  const res = await post('/api/admin/login', { id: 'admin', password: 'admin1234' });
  expect(res.status).toBe(200);
  // 백엔드 실스키마 — 로그인 응답으로 access token이 온다
  const { data } = await res.json();
  expect(data).toHaveProperty('accessToken');
}

describe('관리자 핸들러 등록 순서', () => {
  it('admin/claim/list가 제보 목록을 주고 유형·null 필드를 포함한다', async () => {
    await adminLogin();
    const res = await get('/api/admin/claim/list');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.length).toBe(26);
    expect(data[0]).toHaveProperty('claimId');
    expect(data[0]).toHaveProperty('claimType');
    // 기타 문의는 자전거·부위가 없다 — 화면이 null을 받도록 시드에 섞여 있어야 한다
    const etc = data.find((c: { claimType: string }) => c.claimType === 'ETC');
    expect(etc.cycleId).toBeNull();
    expect(etc.category).toBeNull();
  });

  it('cycle/list·statics(고정)와 cycle/:cycleId(파라미터)가 각각 응답한다', async () => {
    await adminLogin();
    const list = await (await get('/api/admin/cycle/list')).json();
    expect(list.data.length).toBe(90);
    const statics = await (await get('/api/admin/cycle/statics')).json();
    expect(statics.data.totalCycleCnt).toBe(90);
    // 개별 조회는 실서버처럼 이용 이력 리스트만 온다
    const detail = await (await get('/api/admin/cycle/DJ-10001')).json();
    expect(Array.isArray(detail.data)).toBe(true);
    expect(detail.data[0]).toHaveProperty('recordId');
  });

  it('admin/claim/list(고정)가 admin/claim/:claimId(상세)에 잡히지 않는다', async () => {
    await adminLogin();
    const res = await get('/api/admin/claim/26');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    // list가 :claimId에 먼저 잡혔다면 상세가 아니라 배열이 왔을 것
    expect(data.claimId).toBe(26);
    expect(data).toHaveProperty('claimType');
    expect(data).toHaveProperty('adminComment');
    // 이용 기록 필드는 백엔드 응답에서 빠졌다
    expect(data).not.toHaveProperty('rentalAt');
  });

  it('admin/claim/cycle/{cycleId}는 그 자전거의 제보만 준다', async () => {
    await adminLogin();
    const list = await (await get('/api/admin/claim/list')).json();
    const target = list.data.find((c: { cycleId: string | null }) => c.cycleId !== null);
    const res = await get(`/api/admin/claim/cycle/${target.cycleId}`);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((c: { cycleId: string }) => c.cycleId === target.cycleId)).toBe(true);
  });

  it('station/trend(고정)가 station/:stationId에 잡히지 않고 주간 추이를 준다', async () => {
    await adminLogin();
    const res = await get('/api/admin/station/trend?term=week');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toHaveLength(7);
    expect(data[0]).toHaveProperty('rentalCnt');
  });

  it('user/list(고정)와 user/:userId(파라미터)가 각각 응답한다', async () => {
    await adminLogin();
    const list = await (await get('/api/admin/user/list')).json();
    expect(list.data.length).toBe(30);
    // 상세 응답에는 userId·상태가 없다 (AdminUserDetailResponse 실측)
    const detail = await (await get('/api/admin/user/7')).json();
    expect(Object.keys(detail.data).sort()).toEqual([
      'createdAt',
      'nickname',
      'recentUsingAt',
      'totalUsingCnt',
      'totalUsingTime',
    ]);
    // 시드에 7번 사용자의 진행 중 제재가 있어 목록은 BANNED로 준다
    expect(list.data.find((u: { userId: number }) => u.userId === 7).userStatement).toBe('BANNED');
  });

  it('user/:userId/ban은 밴 이력 전체를 최신순 리스트로 준다', async () => {
    await adminLogin();
    const { data } = await (await get('/api/admin/user/7/ban')).json();
    expect(data).toHaveLength(3);
    expect(data[0]).toHaveProperty('banRecordId');
    // 진행 중인 제재(종료 시각이 미래)가 맨 앞
    expect(new Date(data[0].banEndAt).getTime()).toBeGreaterThan(Date.now());
    // 밴 기록이 없는 사용자는 404가 아니라 빈 배열
    const none = await (await get('/api/admin/user/8/ban')).json();
    expect(none.data).toEqual([]);
  });

  it('user/:userId/path는 총 이용 거리와 경로 목록을 준다', async () => {
    await adminLogin();
    const { data } = await (await get('/api/admin/user/7/path')).json();
    expect(data.totalUsingDistance).toBeGreaterThan(0);
    expect(data.pathsList[0]).toHaveProperty('cycleDuration');
    // 총 소요 시간은 도보를 포함하므로 자전거 탑승 시간보다 길다
    expect(data.pathsList[0].totalDuration).toBeGreaterThan(data.pathsList[0].cycleDuration);
  });

  it('admin/notice/list가 관리자 공지 목록을 준다 (본문은 없다)', async () => {
    await adminLogin();
    const res = await get('/api/admin/notice/list');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    // 시드 17건 (기본 5 + 월별 점검 12) — NoticeListResponse라 content는 없다
    expect(data).toHaveLength(17);
    expect(data[0]).toHaveProperty('noticeId');
    expect(data[0]).toHaveProperty('author');
    expect(data[0]).toHaveProperty('popupId');
    expect(data.some((notice: { popupId: number | null }) => notice.popupId === null)).toBe(true);
    expect(data[0]).not.toHaveProperty('content');
  });

  it('admin/notice/:id가 본문을 주고 /list에 잡아먹히지 않는다', async () => {
    await adminLogin();
    const res = await get('/api/admin/notice/1');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    // NoticeDetailResponse — noticeId 없이 본문이 온다
    expect(data).toHaveProperty('content');
    expect(data).not.toHaveProperty('noticeId');
    expect((await get('/api/admin/notice/9999')).status).toBe(404);
  });

  it('관리자 미로그인 요청은 401', async () => {
    const res = await get('/api/admin/cycle/list');
    expect(res.status).toBe(401);
    const notice = await get('/api/admin/notice/list');
    expect(notice.status).toBe(401);
    const detail = await get('/api/admin/notice/1');
    expect(detail.status).toBe(401);
  });

  it('공지 팝업은 실서버 경로(notice/pop-up)와 스키마로 응답한다', async () => {
    await post('/api/auth/mock-login');
    const res = await get('/api/notice/pop-up');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toHaveLength(5);
    expect(data.map((popup: { photoUrl: string }) => popup.photoUrl)).toEqual([
      '/notices/notice-01-temporary-closure.jpg',
      '/notices/notice-02-public-data-survey.jpg',
      '/notices/notice-03-terms-update.jpg',
      '/notices/notice-04-safety-check.jpg',
      '/notices/notice-05-return-check.jpg',
    ]);
    expect(data[0]).toHaveProperty('noticeId');
    expect(data[0]).toHaveProperty('popupId');
    // 팝업은 항상 공지에 연결된다(백엔드 not null)
    expect(data.every((p: { noticeId: number | null }) => p.noticeId !== null)).toBe(true);
  });
});

describe('도메인 간 저장소 공유', () => {
  it('모바일 이용자도 공지 목록(/notice/list)을 읽을 수 있다', async () => {
    await post('/api/auth/mock-login');
    const res = await get('/api/notice/list');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    // 관리자 시드 17건 (기본 5 + 월별 점검 12). 본문은 목록에 없다
    expect(data).toHaveLength(17);
    expect(data[0]).toHaveProperty('title');
    expect(data[0]).not.toHaveProperty('content');
  });

  it('로그인 없이 모바일 API를 부르면 401', async () => {
    const res = await get('/api/cycle/usage/list');
    expect(res.status).toBe(401);
  });
});

describe('이용 기록 저장 (POST /cycle/usage)', () => {
  it('실제 경로 응답을 변환해 보내면 서버 검증을 통과한다', async () => {
    await post('/api/auth/mock-login');
    const path = await (
      await get('/api/map/path?startLat=36.3504&startLng=127.3845&endLat=36.3315&endLng=127.4346')
    ).json();
    const route = path.data.routes[0];

    const road = toUsagePath(route);
    // 좌표가 뒤집히지 않았는지 — 대전은 위도 36, 경도 127이다
    expect(road[0].latitude).toBeGreaterThan(30);
    expect(road[0].latitude).toBeLessThan(40);
    expect(road[0].longitude).toBeGreaterThan(120);
    // 자전거 구간이 있는 경로면 세 단계가 모두 나온다
    expect(new Set(road.map((p) => p.travelStatus))).toEqual(
      new Set(['WALK1', 'BIKE', 'WALK2']),
    );

    const legs = route.legs.filter((leg: { distance: number }) => leg.distance > 0);
    const total = legs.reduce((sum: number, leg: { distance: number }) => sum + leg.distance, 0);
    const bike = legs
      .filter((leg: { mode: string }) => leg.mode === 'BICYCLE')
      .reduce((sum: number, leg: { distance: number }) => sum + leg.distance, 0);

    const res = await post('/api/cycle/usage', {
      cycleUsageId: 1,
      pathInfo: { road },
      createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      finishedAt: new Date().toISOString(),
      totalDistance: Math.round(total),
      bikeDistance: Math.min(Math.round(bike), Math.round(total)),
    });
    expect(res.status).toBe(200);
  });

  it('자전거 거리가 전체 거리를 넘으면 400', async () => {
    await post('/api/auth/mock-login');
    const res = await post('/api/cycle/usage', {
      cycleUsageId: 1,
      pathInfo: { road: [{ latitude: 36.35, longitude: 127.38, altitude: 50, travelStatus: 'BIKE', seq: 0 }] },
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      finishedAt: new Date().toISOString(),
      totalDistance: 100,
      bikeDistance: 900,
    });
    expect(res.status).toBe(400);
  });
});

describe('민원 접수·조회 (claim 계약)', () => {
  /** 고장·방치는 multipart라 FormData로 보낸다 */
  const postForm = (path: string, fields: Record<string, string>) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    return fetch(`http://localhost${path}`, { method: 'POST', body: form });
  };

  it('세 유형을 접수하면 내 민원 목록에 함께 나온다', async () => {
    await post('/api/auth/mock-login');

    const broken = await postForm('/api/claim/cycle', {
      cycleId: 'DJ-10000',
      claimCategory: 'BREAK',
      content: '브레이크가 안 잡혀요',
    });
    expect(broken.status).toBe(200);
    expect((await broken.json()).data).toHaveProperty('claimId');

    expect(
      (await postForm('/api/claim/abandoned', { cycleId: 'DJ-10001', content: '길가에 방치됨' }))
        .status,
    ).toBe(200);
    expect((await post('/api/claim/etc', { content: '문의드립니다' })).status).toBe(200);

    const { data } = await (await get('/api/claim/list/me')).json();
    expect(data.map((c: { claimType: string }) => c.claimType).sort()).toEqual([
      'ABANDONED',
      'CYCLE',
      'ETC',
    ]);
    // 고장만 부위가 있다
    const cycle = data.find((c: { claimType: string }) => c.claimType === 'CYCLE');
    expect(cycle.claimCategory).toBe('BREAK');
    const etc = data.find((c: { claimType: string }) => c.claimType === 'ETC');
    expect(etc.claimCategory).toBeNull();
    // 응답에 자전거 코드는 없다(백엔드 ClaimListResponse 기준)
    expect(cycle).not.toHaveProperty('cycleId');
  });

  it('필수값이 빠지면 400', async () => {
    await post('/api/auth/mock-login');
    expect((await postForm('/api/claim/cycle', { cycleId: 'DJ-1', content: '내용' })).status).toBe(
      400,
    );
    expect((await postForm('/api/claim/abandoned', { content: '자전거 없음' })).status).toBe(400);
    expect((await post('/api/claim/etc', { content: '  ' })).status).toBe(400);
  });

  it('로그인 없이 접수하면 401', async () => {
    expect((await post('/api/claim/etc', { content: '문의' })).status).toBe(401);
  });
});

describe('가입 흐름 (users/me 계약)', () => {
  it('가입 전에는 me가 403, 가입 후에는 닉네임과 월간 통계를 준다', async () => {
    // 첫 카카오 로그인 = GUEST — 실서버처럼 me가 권한 403
    await post('/api/auth/mock-login');
    expect((await get('/api/users/me')).status).toBe(403);

    // 필수 약관 동의 + 닉네임으로 가입 완료 (agrees는 [code, version] 쌍)
    const signUp = await post('/api/auth/sign-up', {
      agrees: [
        ['SERVICE', '1.0'],
        ['PRIVACY', '1.0'],
        ['LOCATION', '1.0'],
      ],
      nickname: '잘타슈',
    });
    expect(signUp.status).toBe(200);

    const me = await get('/api/users/me');
    expect(me.status).toBe(200);
    const { data } = await me.json();
    expect(data.nickname).toBe('잘타슈');
    expect(data).toHaveProperty('monthlyMoveCnt');
    expect(data).toHaveProperty('monthlyTime');
  });
});

describe('QR 대여 → 반납 → 이용 내역', () => {
  const CODE = 'DJ99999';
  const LOCATION = {
    stationId: 'ST0001',
    latitude: 36.362,
    longitude: 127.3565,
  };

  it('빌린 자전거를 반납하면 이용 내역 맨 위에 생긴다', async () => {
    await post('/api/auth/mock-login');

    const rent = await post('/api/cycle/rental', { cycleId: CODE, ...LOCATION });
    expect(rent.status).toBe(200);

    // 같은 자전거를 또 빌릴 수는 없다 — 두 번째 스캔이 반납이어야 하는 이유
    expect((await post('/api/cycle/rental', { cycleId: CODE, ...LOCATION })).status).toBe(409);

    const before = await (await get('/api/cycle/usage/list')).json();
    const give = await post('/api/cycle/return', { cycleId: CODE, ...LOCATION });
    expect(give.status).toBe(200);
    const returned = await give.json();
    expect(returned.data.cycleUsageId).toEqual(expect.any(Number));
    expect(returned.data.returnedAt).toEqual(expect.any(String));

    const after = await (await get('/api/cycle/usage/list')).json();
    expect(after.data).toHaveLength(before.data.length + 1);
    expect(after.data[0].cycleId).toBe(CODE);

    // 반납한 뒤에는 대여 중이 아니므로 또 반납할 수 없다
    expect((await post('/api/cycle/return', { cycleId: CODE, ...LOCATION })).status).toBe(
      409,
    );
  });

  it('대여소에서 300m 밖이면 대여 요청을 거절한다', async () => {
    await post('/api/auth/mock-login');
    const response = await post('/api/cycle/rental', {
      cycleId: 'DJ88888',
      ...LOCATION,
      latitude: LOCATION.latitude + 0.004,
    });
    expect(response.status).toBe(400);
  });

  it('안내 도착 저장이 방금 만든 기록에 붙는다', async () => {
    await post('/api/auth/mock-login');
    await post('/api/cycle/rental', { cycleId: CODE, ...LOCATION });
    await post('/api/cycle/return', { cycleId: CODE, ...LOCATION });

    const { data: list } = await (await get('/api/cycle/usage/list')).json();
    const usageId = list[0].usageId;

    // 저장 전에는 경로가 없어 상세가 요약만 보여준다
    const before = await (await get(`/api/cycle/usage/${usageId}`)).json();
    expect(before.data.pathInfo).toBeNull();

    const road = [
      { latitude: 36.3504, longitude: 127.3845, altitude: 50, travelStatus: 'WALK1', seq: 0 },
      { latitude: 36.3561, longitude: 127.3901, altitude: 55, travelStatus: 'BIKE', seq: 1 },
      { latitude: 36.3602, longitude: 127.3944, altitude: 52, travelStatus: 'WALK2', seq: 2 },
    ];
    const save = await post('/api/cycle/usage', {
      cycleUsageId: usageId,
      pathInfo: { road },
      createdAt: new Date(Date.now() - 600_000).toISOString(),
      finishedAt: new Date().toISOString(),
      totalDistance: 2000,
      bikeDistance: 1500,
    });
    expect(save.status).toBe(200);

    const after = await (await get(`/api/cycle/usage/${usageId}`)).json();
    expect(after.data.pathInfo.road).toHaveLength(3);
    expect(after.data.totalDistance).toBe(2000);
    // 출발·도착은 경로의 처음·끝으로 바뀐다
    expect(after.data.startingPoint.latitude).toBeCloseTo(36.3504, 4);
    expect(after.data.endPoint.latitude).toBeCloseTo(36.3602, 4);
  });
});

describe('QR 자전거 상태 확인', () => {
  it('데모 QR은 점검 필요 상태와 최근 하자 제보를 함께 보여준다', async () => {
    await post('/api/auth/mock-login');

    const statement = await (await get('/api/cycle/statement/22B01260')).json();
    expect(statement.data.rideable).toBe(false);

    const claims = await (await get('/api/claim/list?cycleId=22B01260')).json();
    expect(claims.data).toHaveLength(3);
    expect(claims.data.map((claim: { claimCategory: string }) => claim.claimCategory)).toEqual([
      'BREAK',
      'TIRE',
      'SADDLE',
    ]);
  });
});
