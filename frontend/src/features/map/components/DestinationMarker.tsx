import { useEffect, useRef } from 'react';
import type { PlaceSearchResult } from '@/shared/api/types';
import { posToLatLng } from '@/shared/lib/coords';

/** 목적지 하나가 화면에 크게 들어오는 줌 단계 */
const DESTINATION_ZOOM = 16;

/** 시안의 목적지 핀 크기(px). anchor는 핀 끝(아래 중앙) */
const PIN_WIDTH = 42;
const PIN_HEIGHT = 52;

/**
 * 목적지 핀 — 검정색과 흰색 중심점만 사용해 지도 글자와 겹치지 않게 한다.
 * 네이버 마커 content는 DOM 문자열/요소만 받으므로 정적 SVG 문자열을 쓴다.
 */
const PIN_SVG = `<svg viewBox="0 0 42 52" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" aria-hidden="true" style="filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.28))"><path d="M21 51S4 35.2 4 20.5C4 11.4 11.6 4 21 4s17 7.4 17 16.5C38 35.2 21 51 21 51Z" fill="#18181B" stroke="#fff" stroke-width="2.5"/><circle cx="21" cy="20" r="5" fill="#fff"/></svg>`;

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
        // 경로의 출발·대여·반납 마커보다 위에 둔다.
        zIndex: 4,
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
