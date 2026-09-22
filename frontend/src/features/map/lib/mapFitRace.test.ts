// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fitPathAboveSheet } from '@/features/map/lib/mapFit';

/**
 * 목적지 `morph`와 `fitBounds`가 겹치는 상황을 재현한다.
 *
 * 이 버그는 손으로는 거의 못 잡는다 — 목적지 확대 애니메이션이 도는 **그 0.5초 안에** 경로가
 * 도착해야 하기 때문이다. 그래서 지도를 가짜로 만들어 순서를 직접 지시한다.
 *
 * 지도가 가질 수 있는 상태 둘만 있으면 된다.
 * - `morph`: 목적지 확대(z16). 경로가 화면의 몇 배라 한참 삐져나가 있다
 * - `fitted`: `fitBounds`가 반영됨. 경로가 화면 안에 있다
 */

type Mode = 'morph' | 'fitted';

const SIZE = { width: 390, height: 780 };
const SHEET_PX = 460;

/** 상태별 경로의 화면 위치(px) — 점 두 개의 좌표로 표현한다 */
const OFFSETS: Record<Mode, { x: number; y: number }[]> = {
  // 목적지에 바짝 붙어 있어 경로가 사방으로 넘친다
  morph: [
    { x: -800, y: -1200 },
    { x: 1500, y: 2400 },
  ],
  // 화면 안에 들어왔고, 시트 위 띠(100~296px)에도 들어가는 크기다
  fitted: [
    { x: 40, y: 100 },
    { x: 350, y: 280 },
  ],
};

function createFakeMap(mode: Mode) {
  const calls = { fitBounds: 0, setZoom: 0, panBy: 0 };
  const state = { mode, zoom: 16 };

  const map = {
    getSize: () => SIZE,
    getZoom: () => state.zoom,
    setZoom: (z: number) => {
      calls.setZoom++;
      state.zoom = z;
    },
    panBy: () => {
      calls.panBy++;
    },
    fitBounds: () => {
      calls.fitBounds++;
      // 실제 `fitBounds`처럼 경로를 화면 안에 넣는다
      state.mode = 'fitted';
    },
    getProjection: () => ({
      fromCoordToOffset: (point: unknown) => OFFSETS[state.mode][(point as { i: number }).i],
    }),
  } as unknown as naver.maps.Map;

  return { map, calls, state };
}

/** 점 두 개면 범위를 정하는 데 충분하다 */
const POINTS = [{ i: 0 }, { i: 1 }] as unknown as naver.maps.LatLng[];

let fireIdle: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  fireIdle = null;
  (globalThis as unknown as { naver: unknown }).naver = {
    maps: {
      Event: {
        addListener: (_map: unknown, _event: string, handler: () => void) => {
          fireIdle = handler;
          return {};
        },
        removeListener: () => {
          fireIdle = null;
        },
      },
      // `panBy`에 넘길 값만 만들면 된다 — 파라미터 프로퍼티는 erasableSyntaxOnly에 걸린다
      Point: function Point(this: { x: number; y: number }, x: number, y: number) {
        this.x = x;
        this.y = y;
      },
    },
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fitPathAboveSheet — 목적지 morph와 겹칠 때', () => {
  it('morph가 fitBounds를 덮어쓴 뒤 온 idle에는 보정하지 않는다 — 그 자리에서 재면 경로 밖으로 튄다', () => {
    const { map, calls, state } = createFakeMap('morph');

    fitPathAboveSheet(map, POINTS, SHEET_PX);
    expect(calls.fitBounds).toBe(1);

    // 아직 돌고 있던 목적지 확대가 우리 fitBounds를 덮어쓰고, 끝나면서 idle을 쏜다
    state.mode = 'morph';
    fireIdle?.();

    // 이 상태에서 재면 "경로가 화면의 몇 배"라 4단계 축소 + 큰 이동이 일어난다 — 그게 버그였다
    expect(calls.setZoom).toBe(0);
    expect(calls.panBy).toBe(0);
    // 대신 fitBounds를 다시 건다
    expect(calls.fitBounds).toBe(2);
  });

  it('다시 건 fitBounds가 살아남으면 그때 보정한다', () => {
    const { map, calls, state } = createFakeMap('morph');

    fitPathAboveSheet(map, POINTS, SHEET_PX);
    state.mode = 'morph';
    fireIdle?.();

    // 두 번째 fitBounds는 덮이지 않았다
    expect(state.mode).toBe('fitted');
    fireIdle?.();

    expect(calls.panBy).toBe(1);
    // 띠 안에 들어가는 크기라 축소는 필요 없다
    expect(calls.setZoom).toBe(0);
  });

  it('계속 덮어써도 결국 물러난다 — 억지로 보정하느니 상대의 화면을 두는 편이 낫다', () => {
    const { map, calls, state } = createFakeMap('morph');

    fitPathAboveSheet(map, POINTS, SHEET_PX);
    for (let i = 0; i < 6; i++) {
      state.mode = 'morph';
      fireIdle?.();
    }

    expect(calls.setZoom).toBe(0);
    expect(calls.panBy).toBe(0);
    // 처음 1회 + 다시 걸기 상한 2회
    expect(calls.fitBounds).toBe(3);
    // 상한을 넘기면 리스너를 놓는다
    expect(fireIdle).toBeNull();
  });
});

describe('fitPathAboveSheet — 방해가 없을 때', () => {
  it('fitBounds가 그대로 적용되면 idle 한 번에 보정한다', () => {
    const { map, calls } = createFakeMap('fitted');

    fitPathAboveSheet(map, POINTS, SHEET_PX);
    fireIdle?.();

    expect(calls.fitBounds).toBe(1);
    expect(calls.panBy).toBe(1);
  });

  it('idle이 오지 않아도 타이머가 받친다 — 뷰가 그대로면 idle 자체가 없다', () => {
    const { map, calls } = createFakeMap('fitted');

    fitPathAboveSheet(map, POINTS, SHEET_PX);
    vi.advanceTimersByTime(600);

    expect(calls.panBy).toBe(1);
  });

  it('취소하면 뒤늦은 idle도 타이머도 아무 일을 하지 않는다', () => {
    const { map, calls } = createFakeMap('fitted');

    const stop = fitPathAboveSheet(map, POINTS, SHEET_PX);
    stop();
    vi.advanceTimersByTime(600);

    expect(calls.panBy).toBe(0);
    expect(calls.setZoom).toBe(0);
  });
});
