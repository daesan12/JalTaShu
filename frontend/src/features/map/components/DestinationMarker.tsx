import { useEffect, useRef } from 'react';
import type { PlaceSearchResult } from '@/shared/api/types';
import { posToLatLng } from '@/shared/lib/coords';

/** 목적지 하나가 화면에 크게 들어오는 줌 단계 */
const DESTINATION_ZOOM = 16;

/** 핀 크기(px). anchor는 핀 끝(아래 중앙) */
const PIN_WIDTH = 32;
const PIN_HEIGHT = 40;

/**
 * 목적지 핀 — 색은 index.css 토큰(text-primary)에서 온다.
 * 네이버 마커 content는 DOM 문자열/요소만 받으므로 정적 SVG 문자열을 쓴다.
 */
const PIN_SVG = `<svg viewBox="0 0 32 40" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" aria-hidden="true" class="text-primary drop-shadow-md"><path d="M16 39s-13-12.4-13-23A13 13 0 1 1 29 16c0 10.6-13 23-13 23Z" fill="currentColor" stroke="#fff" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#fff"/></svg>`;

interface DestinationMarkerProps {
  map: naver.maps.Map;
  /** null이면 핀을 지운다 */
  destination: PlaceSearchResult | null;
}

/** 08에서 고른 목적지를 지도에 핀으로 찍고 그 위치로 이동한다 */
export function DestinationMarker({ map, destination }: DestinationMarkerProps) {
  const markerRef = useRef<naver.maps.Marker | null>(null);

  useEffect(() => {
    if (destination === null) {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      return;
    }
    const { lat, lng } = posToLatLng(destination);
    const position = new naver.maps.LatLng(lat, lng);

    if (markerRef.current === null) {
      markerRef.current = new naver.maps.Marker({
        map,
        position,
        title: destination.title,
        icon: {
          content: PIN_SVG,
          size: new naver.maps.Size(PIN_WIDTH, PIN_HEIGHT),
          anchor: new naver.maps.Point(PIN_WIDTH / 2, PIN_HEIGHT),
        },
        // 대여소 마커(선택 시 1)보다 위에 둔다
        zIndex: 2,
      });
    } else {
      markerRef.current.setPosition(position);
      markerRef.current.setTitle(destination.title);
    }
    // 목적지가 바뀔 때마다 그 위치로 부드럽게 이동
    map.morph(position, DESTINATION_ZOOM);
  }, [map, destination]);

  // 지도가 바뀌거나 사라질 때 핀 정리
  useEffect(() => {
    return () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
    };
  }, [map]);

  return null;
}
