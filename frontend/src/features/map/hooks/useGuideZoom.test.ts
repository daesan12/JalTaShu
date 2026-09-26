// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useGuideZoom } from '@/features/map/hooks/useGuideZoom';
import type { Pos, TravelMode } from '@/shared/api/types';

/** 안내 중 확대는 시작할 때와 이동 수단이 바뀔 때만 — 위치가 갱신될 때마다 되돌리면 안 된다 */

const A: Pos = { xPos: 127.38, yPos: 36.35 };
const B: Pos = { xPos: 127.39, yPos: 36.36 };

function setup() {
  const zooms: number[] = [];
  const map = {
    morph: (_: unknown, zoom: number) => zooms.push(zoom),
  } as unknown as naver.maps.Map;
  const mapRef = { current: map };
  const { rerender } = renderHook(
    (props: { active: boolean; mode: TravelMode | null; position: Pos | null }) =>
      useGuideZoom({ mapRef, ...props }),
    { initialProps: { active: true, mode: 'WALK', position: A } },
  );
  return { zooms, rerender };
}

beforeEach(() => {
  vi.stubGlobal('naver', { maps: { LatLng: class {} } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useGuideZoom', () => {
  it('안내를 시작하면 도보 17로 확대하고, 위치가 바뀌어도 다시 확대하지 않는다', () => {
    const { zooms, rerender } = setup();
    expect(zooms).toEqual([17]);
    rerender({ active: true, mode: 'WALK', position: B });
    expect(zooms).toEqual([17]);
  });

  it('자전거 구간이 되면 16, 다시 걸으면 17', () => {
    const { zooms, rerender } = setup();
    rerender({ active: true, mode: 'BICYCLE', position: B });
    rerender({ active: true, mode: 'WALK', position: A });
    expect(zooms).toEqual([17, 16, 17]);
  });

  it('위치를 아직 모르면 기다렸다가 한 번 확대한다', () => {
    const { zooms, rerender } = setup();
    rerender({ active: false, mode: null, position: null });
    rerender({ active: true, mode: 'WALK', position: null });
    expect(zooms).toEqual([17]);
    rerender({ active: true, mode: 'WALK', position: A });
    expect(zooms).toEqual([17, 17]);
  });
});
