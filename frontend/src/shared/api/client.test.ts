// @vitest-environment jsdom
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, client, refreshAccessToken, setAccessToken } from '@/shared/api/client';

/** 서버 흉내 — 요청을 기록하고 경로별 응답을 정한다 */
function fakeServer(handle: (config: InternalAxiosRequestConfig) => { status: number; data?: unknown }) {
  const calls: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config);
    const { status, data } = handle(config);
    const response = { status, statusText: '', headers: {}, config, data };
    if (status >= 400) {
      throw new AxiosError('fail', String(status), config, null, response);
    }
    return response;
  };
  client.defaults.adapter = adapter;
  return calls;
}

const tokenBody = (token: string) => ({
  code: 200,
  message: 'ok',
  data: { accessToken: token, tokenType: 'Bearer', expiresIn: 900 },
});
const okBody = { code: 200, message: 'ok', data: 'list' };

/** 다른 탭 흉내 — 같은 이름의 채널 */
let peer: BroadcastChannel;
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  window.history.pushState({}, '', '/admin');
  peer = new BroadcastChannel('tashu-auth');
});

afterEach(async () => {
  peer.close();
  vi.unstubAllGlobals();
  setAccessToken(null);
  await flush();
});

describe('재발급', () => {
  it('만료된 AT를 재발급 요청에 싣지 않는다', async () => {
    setAccessToken('expired');
    const calls = fakeServer((config) =>
      config.url === '/admin/token/refresh'
        ? { status: 200, data: tokenBody('fresh') }
        : config.headers.Authorization === 'Bearer fresh'
          ? { status: 200, data: okBody }
          : { status: 401 },
    );

    await expect(apiGet('/admin/user/list')).resolves.toBe('list');
    const refresh = calls.find((c) => c.url === '/admin/token/refresh');
    expect(refresh?.headers.Authorization).toBeUndefined();
  });

  it('동시에 401을 받아도 재발급은 한 번만 한다', async () => {
    setAccessToken('expired');
    const calls = fakeServer((config) =>
      config.url === '/admin/token/refresh'
        ? { status: 200, data: tokenBody('fresh') }
        : config.headers.Authorization === 'Bearer fresh'
          ? { status: 200, data: okBody }
          : { status: 401 },
    );

    await Promise.all([apiGet('/admin/a'), apiGet('/admin/b'), apiGet('/admin/c')]);
    expect(calls.filter((c) => c.url === '/admin/token/refresh')).toHaveLength(1);
  });

  it('락을 기다리는 동안 다른 탭이 재발급했으면 또 회전하지 않는다', async () => {
    const calls = fakeServer(() => ({ status: 200, data: tokenBody('mine') }));
    // 다른 탭이 락을 쥐고 재발급한 뒤 토큰을 보내고 락을 놓는 상황
    vi.stubGlobal('navigator', {
      locks: {
        request: async (_name: string, task: () => Promise<unknown>) => {
          peer.postMessage({ type: 'token', realm: 'admin', token: 'from-peer' });
          await flush();
          return task();
        },
      },
    });

    await expect(refreshAccessToken()).resolves.toBe('from-peer');
    expect(calls).toHaveLength(0);
  });

  it('재발급에 성공하면 다른 탭에 새 토큰을 알린다', async () => {
    fakeServer(() => ({ status: 200, data: tokenBody('fresh') }));
    const received: unknown[] = [];
    peer.onmessage = (event) => received.push(event.data);

    await refreshAccessToken();
    await flush();
    expect(received).toContainEqual({ type: 'token', realm: 'admin', token: 'fresh' });
  });
});

describe('탭 간 토큰 공유', () => {
  it('다른 탭이 보낸 새 토큰으로 요청한다', async () => {
    const calls = fakeServer(() => ({ status: 200, data: okBody }));
    peer.postMessage({ type: 'token', realm: 'admin', token: 'from-peer' });
    await flush();

    await apiGet('/admin/user/list');
    expect(calls[0]?.headers.Authorization).toBe('Bearer from-peer');
  });

  it('이용자 탭이 보낸 토큰은 관리자 탭이 받지 않는다', async () => {
    const calls = fakeServer(() => ({ status: 200, data: okBody }));
    peer.postMessage({ type: 'token', realm: 'user', token: 'user-token' });
    await flush();

    await apiGet('/admin/user/list');
    expect(calls[0]?.headers.Authorization).toBeUndefined();
  });

  it('요청 중에 토큰이 바뀌었으면 재발급 없이 새 토큰으로 재시도한다', async () => {
    setAccessToken('old');
    const calls = fakeServer((config) => {
      if (config.headers.Authorization === 'Bearer old') {
        // 이 요청이 도는 사이 다른 탭이 회전시켜 새 토큰이 도착했다
        setAccessToken('new');
        return { status: 401 };
      }
      return config.headers.Authorization === 'Bearer new'
        ? { status: 200, data: okBody }
        : { status: 500 };
    });

    await expect(apiGet('/admin/user/list')).resolves.toBe('list');
    expect(calls.some((c) => c.url === '/admin/token/refresh')).toBe(false);
  });
});
