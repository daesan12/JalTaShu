import { useMemo } from 'react';
import type { RouteCandidate } from '@/shared/api/types';
import { RouteLandmarkMarkers } from '@/features/map/components/RouteLandmarkMarkers';
import { StaticRouteMap, type RouteMapSegment } from '@/features/map/components/StaticRouteMap';
import { splitByLeg } from '@/features/map/lib/routeSegments';

interface RouteResultMapProps {
  route: RouteCandidate;
  /** 지도를 못 띄웠을 때 대신 보여줄 것 — 키가 없거나 네트워크가 끊긴 경우 */
  fallback: React.ReactNode;
}

/**
 * 지나온 경로를 실제 지도 위에 그려 보여준다(12 도착 요약).
 * 그리기는 `StaticRouteMap`이 맡고, 여기서는 탐색 경로를 구간으로 바꾸고 출발·대여소·반납소·도착 핀을 얹는다.
 */
export function RouteResultMap({ route, fallback }: RouteResultMapProps) {
  const segments = useMemo<RouteMapSegment[]>(
    () =>
      splitByLeg(route).map(({ leg, points }) => ({
        mode: leg.mode === 'WALK' ? 'WALK' : 'BIKE',
        points,
      })),
    [route],
  );

  return (
    <StaticRouteMap
      segments={segments}
      fallback={fallback}
      renderOverlay={(map) => <RouteLandmarkMarkers map={map} route={route} showDestination />}
    />
  );
}
