import { useEffect } from 'react';
import {
  DESTINATION_PIN_FILL,
  PIN_HEIGHT,
  PIN_WIDTH,
  START_PIN_FILL,
  pinSvg,
} from '@/features/map/lib/mapPins';

const START_PIN = pinSvg(START_PIN_FILL);
const END_PIN = pinSvg(DESTINATION_PIN_FILL);

interface EndpointPinsProps {
  map: naver.maps.Map;
  start: { lat: number; lng: number } | null;
  end: { lat: number; lng: number } | null;
}

/** 출발(파랑)·도착(검정) 핀만 찍는다 — 대여소 정보가 없는 저장 경로(23 기록 상세)에 쓴다 */
export function EndpointPins({ map, start, end }: EndpointPinsProps) {
  useEffect(() => {
    const markers: naver.maps.Marker[] = [];
    const place = (position: { lat: number; lng: number }, title: string, content: string) => {
      markers.push(
        new naver.maps.Marker({
          map,
          position: new naver.maps.LatLng(position.lat, position.lng),
          title,
          icon: {
            content,
            size: new naver.maps.Size(PIN_WIDTH, PIN_HEIGHT),
            anchor: new naver.maps.Point(PIN_WIDTH / 2, PIN_HEIGHT),
          },
          zIndex: 3,
          clickable: false,
        }),
      );
    };
    if (start !== null) place(start, '출발', START_PIN);
    if (end !== null) place(end, '도착', END_PIN);
    return () => {
      for (const marker of markers) marker.setMap(null);
    };
  }, [map, start, end]);

  return null;
}
