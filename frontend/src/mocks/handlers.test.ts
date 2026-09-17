import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '@/mocks/handlers';

/**
 * 도메인별로 쪼갠 핸들러가 하나의 배열로 합쳐져도 동작하는지 확인하는 스모크 테스트.
 * 특히 고정 경로(cycle/claim, station/trend, cycle/list)가 :param 핸들러에
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
  const res = await post('/api/admin/auth/login', { id: 'admin', password: 'admin1234' });
  expect(res.status).toBe(200);
}

describe('관리자 핸들러 등록 순서', () => {
  it('cycle/claim(고정)이 cycle/:cycleId에 잡히지 않고 제보 목록을 준다', async () => {
    await adminLogin();
    const res = await get('/api/admin/cycle/claim');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    // :cycleId에 잡혔다면 404(존재하지 않는 자전거)였을 것
    expect(data.length).toBe(26);
    expect(data[0]).toHaveProperty('claimId');
  });

  it('cycle/list·statics(고정)와 cycle/:cycleId(파라미터)가 각각 응답한다', async () => {
    await adminLogin();
    const list = await (await get('/api/admin/cycle/list')).json();
    expect(list.data.length).toBe(90);
    const statics = await (await get('/api/admin/cycle/statics')).json();
    expect(statics.data.totalCnt).toBe(90);
    const detail = await (await get('/api/admin/cycle/DJ-10001')).json();
    expect(detail.data.cycleId).toBe('DJ-10001');
  });

  it('station/trend(고정)가 station/:stationId에 잡히지 않고 7일 추이를 준다', async () => {
    await adminLogin();
    const res = await get('/api/admin/station/trend?stationId=ST0001');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toHaveLength(7);
    expect(data[0]).toHaveProperty('rentalCnt');
  });

  it('user/list(고정)와 user/:userId(파라미터)가 각각 응답한다', async () => {
    await adminLogin();
    const list = await (await get('/api/admin/user/list')).json();
    expect(list.data.length).toBe(30);
    const detail = await (await get('/api/admin/user/7')).json();
    expect(detail.data.userId).toBe(7);
    // 시드에 7번 사용자의 진행 중 제재가 있다
    expect(detail.data.userStatement).toBe('BANNED');
  });

  it('관리자 미로그인 요청은 401', async () => {
    const res = await get('/api/admin/cycle/list');
    expect(res.status).toBe(401);
  });
});

describe('도메인 간 저장소 공유', () => {
  it('모바일 공지 목록이 관리자 공지 저장소를 읽는다', async () => {
    await post('/api/auth/mock-login');
    const res = await get('/api/notices');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    // 관리자 시드 18건 (기본 5 + 월별 점검 13)
    expect(data).toHaveLength(18);
    expect(data[0]).toHaveProperty('title');
  });

  it('로그인 없이 모바일 API를 부르면 401', async () => {
    const res = await get('/api/rides');
    expect(res.status).toBe(401);
  });
});
