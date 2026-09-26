// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { CurrentLocationMarker } from '@/features/map/components/CurrentLocationMarker';
import type { Pos } from '@/shared/api/types';

/**
 * 안내 중 지도가 자꾸 줌 16으로 되돌아가던 버그를 재현한다(실기기: 12초에 8번).
 * "현재 위치로 이동" 신호는 **한 번만** 처리돼야 하고, 위치가 갱신될 때마다 다시 처리되면 안 된다.
 * 네이버 SDK는 실제로 띄울 수 없으니 필요한 클래스만 가짜로 둔다.
 */

class FakeMarker {
  private readonly el = document.createElement('div');
  constructor() {
    this.el.innerHTML = '<span data-heading class="hidden"></span>';
  }
  setMap() {}
  setPosition() {}
  setZIndex() {}
  getElement() {
    return this.el;
  }
}

function createFakeMap() {
  const calls = { morph: 0, setCenter: 0 };
  const map = {
    morph: () => calls.morph++,
    setCenter: () => calls.setCenter++,
  } as unknown as naver.maps.Map;
  return { map, calls };
}

const A: Pos = { xPos: 127.38, yPos: 36.35 };
const B: Pos = { xPos: 127.39, yPos: 36.36 };
const C: Pos = { xPos: 127.4, yPos: 36.37 };

beforeEach(() => {
  vi.stubGlobal('naver', {
    maps: {
      Marker: FakeMarker,
      LatLng: class {},
      Size: class {},
      Point: class {},
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('현재 위치로 이동 신호', () => {
  it('위치가 갱신돼도 같은 신호는 다시 처리하지 않는다', () => {
    const { map, calls } = createFakeMap();
    const { rerender } = render(
      <CurrentLocationMarker map={map} position={A} focusToken={1} follow />,
    );
    expect(calls.morph).toBe(1);

    rerender(<CurrentLocationMarker map={map} position={B} focusToken={1} follow />);
    rerender(<CurrentLocationMarker map={map} position={C} focusToken={1} follow />);
    expect(calls.morph).toBe(1);
    // 따라가기는 위치마다 중심만 옮긴다 — 줌은 건드리지 않는다
    expect(calls.setCenter).toBe(3);
  });

  // 안내 시작은 위치를 받기 전에 신호를 올린다 — 위치가 뒤늦게 와도 한 번은 이동해야 한다
  it('신호가 먼저 오고 위치가 나중에 와도 한 번 이동한다', () => {
    const { map, calls } = createFakeMap();
    const { rerender } = render(
      <CurrentLocationMarker map={map} position={null} focusToken={1} follow />,
    );
    expect(calls.morph).toBe(0);

    rerender(<CurrentLocationMarker map={map} position={A} focusToken={1} follow />);
    expect(calls.morph).toBe(1);
    rerender(<CurrentLocationMarker map={map} position={B} focusToken={1} follow />);
    expect(calls.morph).toBe(1);
  });

  it('새 신호가 오면 다시 이동한다', () => {
    const { map, calls } = createFakeMap();
    const { rerender } = render(<CurrentLocationMarker map={map} position={A} focusToken={1} />);
    rerender(<CurrentLocationMarker map={map} position={A} focusToken={2} />);
    expect(calls.morph).toBe(2);
  });
});
