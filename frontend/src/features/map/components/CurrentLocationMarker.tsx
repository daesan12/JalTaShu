import { useEffect, useRef } from 'react';
import type { Pos } from '@/shared/api/types';
import { posToLatLng } from '@/shared/lib/coords';

/** 내 위치 하나가 화면에 크게 들어오는 줌 단계 — 목적지 핀과 같은 값 */
const CURRENT_LOCATION_ZOOM = 16;

const DOT_SIZE = 22;

/**
 * 내 위치 점 — 지도 앱 관례대로 파란 점에 흰 테두리, 바깥은 옅은 원.
 * 네이버 마커 content는 DOM 문자열을 받고 페이지 안에서 그려지므로 Tailwind 클래스가 그대로 먹는다
 * (목적지 핀도 같은 방식). 정확도 반경 원은 그리지 않는다.
 *
 * ⚠ 클래스는 **문자열 그대로** 적는다 — Tailwind 4는 소스에서 찾은 문자열만 CSS로 내보내므로
 * `h-[${DOT_SIZE}px]`처럼 조합하면 그 클래스가 만들어지지 않는다. 크기를 바꾸면 아래 두 곳을 같이 고친다.
 */
const DOT_HTML = `<span class="relative block h-[22px] w-[22px]" aria-hidden="true"><span class="absolute inset-0 rounded-full bg-blue-600/20"></span><span class="absolute inset-[5px] rounded-full bg-blue-600 ring-2 ring-white"></span></span>`;

interface CurrentLocationMarkerProps {
  map: naver.maps.Map;
  /** null이면 점을 지운다 */
  position: Pos | null;
  /**
   * 이 값이 바뀔 때마다 그 위치로 지도를 옮긴다.
   * 좌표가 같아도(같은 자리에서 버튼을 다시 눌러도) 다시 이동해야 해서 좌표와 따로 둔다.
   */
  focusToken: number;
}

/** 현재 위치를 지도에 점으로 찍고, 버튼을 누를 때마다 그 위치로 이동한다 */
export function CurrentLocationMarker({ map, position, focusToken }: CurrentLocationMarkerProps) {
  const markerRef = useRef<naver.maps.Marker | null>(null);

  useEffect(() => {
    if (position === null) {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      return;
    }
    const { lat, lng } = posToLatLng(position);
    const point = new naver.maps.LatLng(lat, lng);

    if (markerRef.current === null) {
      markerRef.current = new naver.maps.Marker({
        map,
        position: point,
        title: '현재 위치',
        icon: {
          content: DOT_HTML,
          size: new naver.maps.Size(DOT_SIZE, DOT_SIZE),
          anchor: new naver.maps.Point(DOT_SIZE / 2, DOT_SIZE / 2),
        },
        // 대여소 마커·목적지 핀보다 아래 — 내 위치는 배경 정보다
        zIndex: 1,
        clickable: false,
      });
    } else {
      markerRef.current.setPosition(point);
    }
  }, [map, position]);

  // 버튼을 누른 순간에만 이동한다. 위치 갱신만으로 지도가 멋대로 움직이지 않게 분리했다
  useEffect(() => {
    if (focusToken === 0 || position === null) return;
    const { lat, lng } = posToLatLng(position);
    map.morph(new naver.maps.LatLng(lat, lng), CURRENT_LOCATION_ZOOM);
  }, [map, focusToken, position]);

  useEffect(() => {
    return () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
    };
  }, [map]);

  return null;
}
