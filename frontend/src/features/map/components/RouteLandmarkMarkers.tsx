import { useEffect, useRef } from 'react';
import type { RouteCandidate } from '@/shared/api/types';
import { osrmToLatLng } from '@/shared/lib/coords';
import { routeLatLngs } from '@/features/map/lib/routeSegments';

const START_PIN_WIDTH = 42;
const START_PIN_HEIGHT = 52;
const STATION_MARKER_SIZE = 38;

const START_BLUE = '#2563EB';
const STATION_GREEN = '#4C8A12';

/** 출발은 파란색 핀과 흰색 중심점만 표시한다. */
const START_PIN = `<svg viewBox="0 0 42 52" width="${START_PIN_WIDTH}" height="${START_PIN_HEIGHT}" aria-hidden="true" style="filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.28))"><path d="M21 51S4 35.2 4 20.5C4 11.4 11.6 4 21 4s17 7.4 17 16.5C38 35.2 21 51 21 51Z" fill="${START_BLUE}" stroke="#fff" stroke-width="2.5"/><circle cx="21" cy="20" r="5" fill="#fff"/></svg>`;

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
export function RouteLandmarkMarkers({ map, route }: RouteLandmarkMarkersProps) {
  const markersRef = useRef<naver.maps.Marker[]>([]);

  useEffect(() => {
    const markers = markersRef.current;
    for (const marker of markers) marker.setMap(null);
    markers.length = 0;
    if (route === null) return;

    const start = routeLatLngs(route)[0];
    if (start === undefined) return;

    const landmarks: Landmark[] = [
      {
        position: start,
        title: '출발',
        content: START_PIN,
        width: START_PIN_WIDTH,
        height: START_PIN_HEIGHT,
        anchor: new naver.maps.Point(START_PIN_WIDTH / 2, START_PIN_HEIGHT),
      },
    ];

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
  }, [map, route]);

  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      for (const marker of markers) marker.setMap(null);
      markers.length = 0;
    };
  }, [map]);

  return null;
}
