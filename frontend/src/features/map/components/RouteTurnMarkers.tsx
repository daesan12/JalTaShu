import { useEffect, useRef } from 'react';
import type { RouteCandidate } from '@/shared/api/types';
import { osrmToLatLng } from '@/shared/lib/coords';
import { readCssToken } from '@/shared/lib/cssToken';
import { buildRouteCues } from '@/features/map/lib/routeCues';

/**
 * 경로가 **어디서 꺾이는지**를 지도에 점으로 찍는다.
 *
 * 경로선만 그리면 어느 모퉁이에서 꺾는지 눈으로 짚기 어렵다. 회전 지점은 서버가 step마다 주는
 * `behave.location`이고, 안내 문구를 고를 때 쓰는 `buildRouteCues()`와 **같은 목록**을 쓴다
 * — 지도에 찍힌 점과 안내가 어긋나지 않게.
 *
 * 출발·도착은 빼고 **실제로 꺾는 지점만** 찍는다. 양 끝은 출발 표시·목적지 핀·대여소 마커가 이미 있다.
 */

/** 점 크기(px) */
const DOT_SIZE = 12;

/**
 * 점 색은 **경로 색을 따라가지 않고 중립색**이다. 10은 후보 종류 색, 11은 도보/자전거 2색이라
 * 경로 색을 쓰면 화면마다 점 색이 달라진다. 점은 "여기서 꺾는다"는 표시일 뿐이라 한 색으로 둔다.
 * (토큰은 `text-gray-700`을 쓰는 곳이 있어 CSS로 나온다 — Tailwind 4는 쓰이는 변수만 내보낸다)
 */
const DOT_CSS_VAR = '--color-gray-700';

/** 네이버 마커 content는 DOM 문자열만 받는다. 색은 토큰에서 읽어 인라인 스타일로 넘긴다 */
function dotHtml(color: string): string {
  return `<div style="width:${DOT_SIZE}px;height:${DOT_SIZE}px;border-radius:9999px;background:#fff;border:3px solid ${color};box-shadow:0 1px 2px rgb(0 0 0 / 0.3)"></div>`;
}

interface RouteTurnMarkersProps {
  map: naver.maps.Map;
  /** null이면 점을 모두 지운다 */
  route: RouteCandidate | null;
}

export function RouteTurnMarkers({ map, route }: RouteTurnMarkersProps) {
  const markersRef = useRef<naver.maps.Marker[]>([]);

  useEffect(() => {
    const markers = markersRef.current;
    for (const marker of markers) marker.setMap(null);
    markers.length = 0;
    if (route === null) return;

    const content = dotHtml(readCssToken(DOT_CSS_VAR));
    for (const cue of buildRouteCues(route)) {
      if (cue.maneuver.type === 'depart' || cue.maneuver.type === 'arrive') continue;
      const { lat, lng } = osrmToLatLng(cue.maneuver.location);
      markers.push(
        new naver.maps.Marker({
          map,
          position: new naver.maps.LatLng(lat, lng),
          title: cue.maneuver.instruction,
          icon: {
            content,
            size: new naver.maps.Size(DOT_SIZE, DOT_SIZE),
            anchor: new naver.maps.Point(DOT_SIZE / 2, DOT_SIZE / 2),
          },
          // 대여소·목적지 마커보다 아래. 점을 탭해도 지도 빈 곳 탭과 같게 동작하도록 클릭은 받지 않는다
          zIndex: 0,
          clickable: false,
        }),
      );
    }
  }, [map, route]);

  // 지도가 바뀌거나 사라질 때 정리
  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      for (const marker of markers) marker.setMap(null);
      markers.length = 0;
    };
  }, [map]);

  return null;
}
