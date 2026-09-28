import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  takePendingUsagePath,
  writePendingUsagePath,
  type PendingUsagePath,
} from '@/features/map/lib/pendingUsagePath';

// vitest 기본 환경(node)에는 localStorage가 없다 — 최소 구현으로 대체
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
});

const pending: PendingUsagePath = {
  cycleId: '22B01262',
  savedAt: 1_000,
  path: {
    pathInfo: { road: [] },
    createdAt: '2026-09-24T10:00:00',
    finishedAt: '2026-09-24T10:20:00',
    totalDistance: 3000,
    bikeDistance: 2500,
  },
};

describe('pendingUsagePath', () => {
  beforeEach(() => localStorage.clear());

  it('같은 자전거의 반납이면 한 번만 꺼내 준다', () => {
    writePendingUsagePath(pending);
    expect(takePendingUsagePath('22B01262', 2_000)).toEqual(pending);
    expect(takePendingUsagePath('22B01262', 2_000)).toBeNull();
  });

  it('다른 자전거의 반납에는 붙이지 않고 버린다', () => {
    writePendingUsagePath(pending);
    expect(takePendingUsagePath('33C00001', 2_000)).toBeNull();
    expect(takePendingUsagePath('22B01262', 2_000)).toBeNull();
  });

  it('오래된 경로는 버린다', () => {
    writePendingUsagePath(pending);
    expect(takePendingUsagePath('22B01262', 1_000 + 4 * 60 * 60 * 1000)).toBeNull();
  });
});
