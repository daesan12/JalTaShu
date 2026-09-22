import { useEffect, useRef } from 'react';
import type { RouteCandidate } from '@/shared/api/types';
import { osrmToLatLng } from '@/shared/lib/coords';
import {
  DESTINATION_PIN_FILL,
  PIN_HEIGHT,
  PIN_WIDTH,
  START_PIN_FILL,
  pinSvg,
} from '@/features/map/lib/mapPins';
import { routeLatLngs } from '@/features/map/lib/routeSegments';

const STATION_MARKER_SIZE = 38;

const STATION_GREEN = '#4C8A12';

/** 출발은 파란 핀, 목적지는 검은 핀 — 목적지 핀과 모양을 공유한다(`lib/mapPins`) */
const START_PIN = pinSvg(START_PIN_FILL);
const DESTINATION_PIN = pinSvg(DESTINATION_PIN_FILL);

/** 두 대여소 마커가 같은 자전거 형태를 공유하고 채움/선 색만 달라지게 한다. */
function stationMarker(fill: string, stroke: string, bike: string): string {
  return `<svg viewBox="0 0 38 38" width="${STATION_MARKER_SIZE}" height="${STATION_MARKER_SIZE}" aria-hidden="true" style="filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.25))"><circle cx="19" cy="19" r="17" fill="${fill}" stroke="#fff" stroke-width="2"/><circle cx="19" cy="19" r="14.5" fill="none" stroke="${stroke}" stroke-width="2"/><g fill="none" stroke="${bike}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12.5" cy="22.5" r="4.5"/><circle cx="26" cy="22.5" r="4.5"/><path d="m12.5 22.5 4.3-8h4.6l4.6 8m-9.2-8 4.6 8h-8.9m4-11h4"/></g></svg>`;
}

/** 대여소: 초록색 채움 + 흰색 자전거. */
const RENTAL_MARKER = stationMarker(STATION_GREEN, STATION_GREEN, '#fff');
/** 반납소: 흰색 채움 + 초록색 테두리와 자전거. */
const RETURN_MARKER = stationMarker('#fff', STATION_GREEN, STATION_GREEN);

interface RouteLandmarkMarkersProps {
  map: naver.maps.Map;
  /** 선택된 경로가 없으면 마커를 모두 지운다. */
  route: RouteCandidate | null;
  /**
   * 경로 끝에 목적지 핀을 함께 찍는다.
   * 메인 지도는 `DestinationMarker`가 따로 찍으므로 기본은 꺼 둔다 — 켜면 핀이 둘 겹친다.
   */
  showDestination?: boolean;
}

interface Landmark {
  position: { lat: number; lng: number };
  title: string;
  content: string;
  width: number;
  height: number;
  anchor: naver.maps.Point;
}

/** 선택 경로 위에 출발점·대여소·반납소를 글자 없는 아이콘으로 표시한다. */
export function RouteLandmarkMarkers({
  map,
  route,
  showDestination = false,
}: RouteLandmarkMarkersProps) {
  const markersRef = useRef<naver.maps.Marker[]>([]);

  useEffect(() => {
    const markers = markersRef.current;
    for (const marker of markers) marker.setMap(null);
    markers.length = 0;
    if (route === null) return;

    const latLngs = routeLatLngs(route);
    const start = latLngs[0];
    if (start === undefined) return;

    const landmarks: Landmark[] = [
      {
        position: start,
        title: '출발',
        content: START_PIN,
        width: PIN_WIDTH,
        height: PIN_HEIGHT,
        anchor: new naver.maps.Point(PIN_WIDTH / 2, PIN_HEIGHT),
      },
    ];

    const end = latLngs[latLngs.length - 1];
    if (showDestination && end !== undefined) {
      landmarks.push({
        position: end,
        title: '도착',
        content: DESTINATION_PIN,
        width: PIN_WIDTH,
        height: PIN_HEIGHT,
        anchor: new naver.maps.Point(PIN_WIDTH / 2, PIN_HEIGHT),
      });
    }

    if (route.startStation !== null) {
      landmarks.push({
        position: osrmToLatLng(route.startStation.location),
        title: `대여소: ${route.startStation.name}`,
        content: RENTAL_MARKER,
        width: STATION_MARKER_SIZE,
        height: STATION_MARKER_SIZE,
        anchor: new naver.maps.Point(STATION_MARKER_SIZE / 2, STATION_MARKER_SIZE / 2),
      });
    }

    if (route.endStation !== null) {
      landmarks.push({
        position: osrmToLatLng(route.endStation.location),
        title: `반납소: ${route.endStation.name}`,
        content: RETURN_MARKER,
        width: STATION_MARKER_SIZE,
        height: STATION_MARKER_SIZE,
        anchor: new naver.maps.Point(STATION_MARKER_SIZE / 2, STATION_MARKER_SIZE / 2),
      });
    }

    for (const landmark of landmarks) {
      markers.push(
        new naver.maps.Marker({
          map,
          position: new naver.maps.LatLng(landmark.position.lat, landmark.position.lng),
          title: landmark.title,
          icon: {
            content: landmark.content,
            size: new naver.maps.Size(landmark.width, landmark.height),
            anchor: landmark.anchor,
          },
          zIndex: 3,
          clickable: false,
        }),
      );
    }
  }, [map, route, showDestination]);

  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      for (const marker of markers) marker.setMap(null);
      markers.length = 0;
    };
  }, [map]);

  return null;
}
