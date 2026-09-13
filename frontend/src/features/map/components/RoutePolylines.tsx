import { useEffect, useRef } from 'react';
import type { RoutePath } from '@/shared/api/types';
import { posToLatLng } from '@/shared/lib/coords';
import { routeStrokeColor } from '@/features/map/lib/routeBadges';
import type { RouteBadgeKind } from '@/features/map/lib/routeMetrics';

/** 선택한 경로는 굵고 진하게, 나머지는 가늘고 옅게 — 색만으로는 4개가 겹칠 때 구분이 안 된다 */
interface StrokeStyle {
  strokeWeight: number;
  strokeOpacity: number;
  zIndex: number;
}
const SELECTED_STYLE: StrokeStyle = { strokeWeight: 7, strokeOpacity: 1, zIndex: 10 };
const OTHER_STYLE: StrokeStyle = { strokeWeight: 5, strokeOpacity: 0.55, zIndex: 1 };

/** 네이버 타입은 setOptions(객체)에 path를 요구해 키 단위 오버로드로 넘긴다 */
function applyStyle(line: naver.maps.Polyline, style: StrokeStyle) {
  line.setOptions('strokeWeight', style.strokeWeight);
  line.setOptions('strokeOpacity', style.strokeOpacity);
  line.setOptions('zIndex', style.zIndex);
}

/**
 * 후보가 전부 보이게 지도를 맞출 때 가려지는 영역(px).
 * 위는 상태바·뒤로가기·범례, 아래는 peek 시트(110) + 여백. 좌우는 선이 화면 끝에 붙지 않게
 */
const FIT_MARGIN = { top: 140, right: 40, bottom: 150, left: 40 };

interface RoutePolylinesProps {
  map: naver.maps.Map;
  /** null이면 선을 모두 지운다 */
  routes: RoutePath[] | null;
  /** 원본 인덱스 순 뱃지 — 경로선 색을 뱃지와 같게 맞춘다 */
  badges: (RouteBadgeKind | null)[];
  selectedIndex: number | null;
}

/**
 * 10 경로 비교 — 후보 전부를 뱃지 색으로 그린다(Figma 10). 도보/자전거 2색 구간 표시는 11에서.
 * 인스턴스는 ref에 두고 후보 목록이 바뀔 때만 다시 만든다. 선택 변경은 스타일만 바꾼다.
 */
export function RoutePolylines({ map, routes, badges, selectedIndex }: RoutePolylinesProps) {
  const linesRef = useRef<naver.maps.Polyline[]>([]);

  useEffect(() => {
    const lines = linesRef.current;
    for (const line of lines) line.setMap(null);
    lines.length = 0;
    if (routes === null || routes.length === 0) return;

    const { Polyline, LatLng } = naver.maps;
    // 후보 전체 좌표 — 새 후보가 오면 출발·도착이 한 화면에 들어오게 맞춘다
    const allPoints: naver.maps.LatLng[] = [];
    routes.forEach((route, index) => {
      const path = route.location.map((pos) => {
        const { lat, lng } = posToLatLng(pos);
        return new LatLng(lat, lng);
      });
      allPoints.push(...path);
      lines.push(
        new Polyline({
          map,
          path,
          strokeColor: routeStrokeColor(badges[index] ?? null),
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          // 선 위를 탭해도 지도 빈 곳 탭(대여소 시트 닫기)과 같게 동작하도록 클릭을 받지 않는다
          clickable: false,
          ...OTHER_STYLE,
        }),
      );
    });
    if (allPoints.length > 0) map.fitBounds(allPoints, FIT_MARGIN);
  }, [map, routes, badges]);

  useEffect(() => {
    linesRef.current.forEach((line, index) => {
      applyStyle(line, index === selectedIndex ? SELECTED_STYLE : OTHER_STYLE);
    });
  }, [selectedIndex, routes]);

  // 지도가 바뀌거나 사라질 때 선 정리
  useEffect(() => {
    const lines = linesRef.current;
    return () => {
      for (const line of lines) line.setMap(null);
      lines.length = 0;
    };
  }, [map]);

  return null;
}
