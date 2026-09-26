// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { StationMarkers } from '@/features/map/components/StationMarkers';
import type { BikeStation } from '@/shared/api/types';

/**
 * 대여소 표시 토글이 느리던 문제를 막는다.
 * 끄고 켤 때 마커를 지우고 다시 만들지 않고, 만들어 둔 마커를 숨기고 보이기만 해야 한다.
 * 네이버 SDK는 실제로 띄울 수 없으니 필요한 클래스만 가짜로 둔다.
 */

let created = 0;
let removed = 0;
let markers: FakeMarker[] = [];

class FakeMarker {
  visible: boolean;
  constructor(options: { visible?: boolean }) {
    created++;
    this.visible = options.visible ?? true;
    markers.push(this);
  }
  setMap(map: unknown) {
    if (map === null) removed++;
  }
  setPosition() {}
  setZIndex() {}
  setVisible(visible: boolean) {
    this.visible = visible;
  }
}

const map = {
  getZoom: () => 18,
  panTo: () => {},
  fitBounds: () => {},
  setZoom: () => {},
} as unknown as naver.maps.Map;

function station(id: string, lat: number, lng: number): BikeStation {
  return { stationId: id, name: id, lat, lng, address: null, currentBikes: 3, updatedAt: null };
}

// 줌 18에서는 묶지 않으므로 대여소마다 마커가 하나씩 생긴다
const STATIONS = [
  station('A', 36.35, 127.38),
  station('B', 36.36, 127.39),
  station('C', 36.37, 127.4),
];

function renderMarkers(visible: boolean) {
  return (
    <StationMarkers
      map={map}
      stations={STATIONS}
      selectedStationId={null}
      onSelectStation={() => {}}
      pickActive={false}
      visible={visible}
    />
  );
}

beforeEach(() => {
  created = 0;
  removed = 0;
  markers = [];
  vi.stubGlobal('naver', {
    maps: {
      Marker: FakeMarker,
      LatLng: class {},
      Size: class {},
      Point: class {},
      Event: { addListener: () => ({}), removeListener: () => {} },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('대여소 표시 토글', () => {
  it('끄고 켜도 마커를 새로 만들지 않는다', () => {
    const { rerender } = render(renderMarkers(true));
    expect(created).toBe(3);

    rerender(renderMarkers(false));
    expect(markers.every((m) => !m.visible)).toBe(true);

    rerender(renderMarkers(true));
    expect(markers.every((m) => m.visible)).toBe(true);
    expect(created).toBe(3);
    expect(removed).toBe(0);
  });

  it('꺼진 상태에서 처음 그려도 마커가 숨겨져 있다', () => {
    render(renderMarkers(false));
    expect(created).toBe(3);
    expect(markers.every((m) => !m.visible)).toBe(true);
  });
});
