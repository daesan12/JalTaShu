import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { LatLng } from '@/shared/lib/coords';
import { reverseGeocode, type PickedPlace } from '@/features/map/lib/reverseGeocode';

/**
 * 지도가 멈춘 뒤 이만큼 기다렸다가 주소를 읽는다.
 * 드래그를 멈췄다 이어서 하는 동안 요청이 줄줄이 나가지 않게 하는 정도면 충분하다.
 */
const LOOKUP_DEBOUNCE_MS = 300;

/** 같은 지점인지 판단하는 정밀도. 소수점 6자리면 약 0.1m라 사람 손으로는 구분되지 않는다 */
const COORD_PRECISION = 6;

export interface MapPickAddress {
  /** 읽어 온 건물명·주소. 아직 없거나 실패했으면 null */
  place: PickedPlace | null;
  /** 주소를 읽는 중(지도를 움직이는 중 포함) */
  loading: boolean;
}

/**
 * 상태 객체를 상수로 두어 **같은 참조로** 갱신한다.
 * 드래그 한 번에 `center_changed`가 수십 번 오는데, 값이 같으면 리액트가 렌더를 건너뛴다.
 */
const MOVING: MapPickAddress = { place: null, loading: true };
const EMPTY: MapPickAddress = { place: null, loading: false };

function coordKey({ lat, lng }: LatLng): string {
  return `${lat.toFixed(COORD_PRECISION)},${lng.toFixed(COORD_PRECISION)}`;
}

interface UseMapPickOptions {
  /** 페이지가 들고 있는 지도 인스턴스 */
  mapRef: RefObject<naver.maps.Map | null>;
  /** 08 "지도에서 선택" 모드인지 — 꺼져 있으면 아무것도 붙이지 않는다 */
  active: boolean;
}

/**
 * 08 "지도에서 선택" 모드의 지도 조작 — 탭으로 지점 옮기기 + 그 지점의 주소 읽기.
 *
 * 탭한 자리에 핀을 따로 찍지 않고 **지도를 그 지점으로 옮긴다**. 중앙 고정 핀이 그 자리에 놓이므로
 * 좌표의 출처가 계속 "지도 중심" 하나로 유지되고, 확정 로직(`confirmMapPick`)을 그대로 쓸 수 있다.
 *
 * 지도가 움직이기 시작하면 읽어 둔 주소를 즉시 버린다 — 확정 순간에 화면의 주소와 실제 좌표가
 * 어긋나는 것(옛 주소가 새 좌표에 붙는 것)을 막기 위해서다.
 */
export function useMapPick({ mapRef, active }: UseMapPickOptions): MapPickAddress {
  const [address, setAddress] = useState<MapPickAddress>(EMPTY);
  // 같은 지점을 다시 보면 네트워크를 타지 않는다. 모드를 껐다 켜도 남긴다
  const cacheRef = useRef<{ key: string; place: PickedPlace | null } | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!active || map === null) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let latest = 0;
    let done = false;

    function lookup() {
      const map = mapRef.current;
      const center = map?.getCenter();
      if (!(center instanceof naver.maps.LatLng)) return;

      const latLng = { lat: center.lat(), lng: center.lng() };
      const key = coordKey(latLng);
      const cached = cacheRef.current;
      if (cached?.key === key) {
        setAddress(cached.place === null ? EMPTY : { place: cached.place, loading: false });
        return;
      }

      const id = ++latest;
      setAddress(MOVING);
      void reverseGeocode(latLng).then((place) => {
        // 늦게 도착한 옛 응답이 최신 결과를 덮어쓰지 않게 한다
        if (done || id !== latest) return;
        cacheRef.current = { key, place };
        setAddress(place === null ? EMPTY : { place, loading: false });
      });
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(lookup, LOOKUP_DEBOUNCE_MS);
    }

    // 들어온 그 자리의 주소부터 채운다 — 지도를 안 움직이면 idle이 오지 않는다
    schedule();

    const listeners = [
      naver.maps.Event.addListener(map, 'click', (event: naver.maps.PointerEvent) => {
        map.panTo(event.coord);
      }),
      // 움직이는 중에 보이던 주소는 이미 틀린 값이다
      naver.maps.Event.addListener(map, 'center_changed', () => setAddress(MOVING)),
      naver.maps.Event.addListener(map, 'idle', schedule),
    ];

    return () => {
      done = true;
      clearTimeout(timer);
      naver.maps.Event.removeListener(listeners);
      // 다음에 이 모드로 들어왔을 때 지난 주소가 잠깐 비치지 않게 비운다
      setAddress(EMPTY);
    };
  }, [mapRef, active]);

  return address;
}
