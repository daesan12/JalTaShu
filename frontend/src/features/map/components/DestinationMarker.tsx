import { useEffect, useRef } from 'react';
import type { PlaceSearchResult } from '@/shared/api/types';
import { posToLatLng } from '@/shared/lib/coords';
import { DESTINATION_PIN_FILL, PIN_HEIGHT, PIN_WIDTH, pinSvg } from '@/features/map/lib/mapPins';

/** 목적지 하나가 화면에 크게 들어오는 줌 단계 */
const DESTINATION_ZOOM = 16;

/** 목적지 핀 — 검정. 출발 핀과 모양을 공유한다(`lib/mapPins`) */
const PIN_SVG = pinSvg(DESTINATION_PIN_FILL);

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
