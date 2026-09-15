import { useEffect, useRef } from 'react';
import type { RoutePath } from '@/shared/api/types';
import { posToLatLng } from '@/shared/lib/coords';
import { readCssToken } from '@/shared/lib/cssToken';
import { WALK_COLOR } from '@/shared/ui/grade';
import { fitPathAboveSheet } from '@/features/map/lib/mapFit';
import { splitByLeg } from '@/features/map/lib/routeSegments';

/**
 * 11 경로 상세의 경로선 — 선택한 경로 하나를 도보/자전거 2색으로 그린다.
 * 10(후보 4개를 뱃지 색·회색으로)과 그리는 규칙이 달라 컴포넌트를 나눴다.
 *
 * 색: 도보는 `shared/ui/grade.ts`의 `WALK_COLOR`(23 기록 상세에서도 도보를 뜻하는 파랑),
 * 자전거는 브랜드색 토큰(`--color-primary`). 네이버 Polyline은 클래스를 못 받아 값으로 넘긴다.
 */
const STROKE_WEIGHT = 7;

interface SelectedRoutePolylineProps {
  map: naver.maps.Map;
  /** null이면 선을 지운다 */
  route: RoutePath | null;
}

export function SelectedRoutePolyline({ map, route }: SelectedRoutePolylineProps) {
  const linesRef = useRef<naver.maps.Polyline[]>([]);

  useEffect(() => {
    const lines = linesRef.current;
    for (const line of lines) line.setMap(null);
    lines.length = 0;
    if (route === null) return;

    const { Polyline, LatLng } = naver.maps;
    const bikeColor = readCssToken('--color-primary');
    const allPoints: naver.maps.LatLng[] = [];

    for (const leg of splitByLeg(route)) {
      const path = leg.points.map((pos) => {
        const { lat, lng } = posToLatLng(pos);
        return new LatLng(lat, lng);
      });
      allPoints.push(...path);
      lines.push(
        new Polyline({
          map,
          path,
          strokeColor: leg.behave === 'WALK' ? WALK_COLOR : bikeColor,
          strokeWeight: STROKE_WEIGHT,
          strokeOpacity: 1,
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          // 선 탭이 지도 빈 곳 탭(대여소 시트 닫기)과 같게 동작하도록 클릭을 받지 않는다
          clickable: false,
          zIndex: 10,
        }),
      );
    }

    if (allPoints.length === 0) return;
    // 지도가 멈춘 뒤 보정하므로, 경로가 바뀌거나 화면을 떠나면 예약을 취소한다
    return fitPathAboveSheet(map, allPoints);
  }, [map, route]);

  useEffect(() => {
    const lines = linesRef.current;
    return () => {
      for (const line of lines) line.setMap(null);
      lines.length = 0;
    };
  }, [map]);

  return null;
}
