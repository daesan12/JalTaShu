import { useEffect, useRef, useState } from 'react';
import type { RouteCandidate } from '@/shared/api/types';
import { readCssToken } from '@/shared/lib/cssToken';
import { WALK_COLOR } from '@/shared/ui/grade';
import { RouteLandmarkMarkers } from '@/features/map/components/RouteLandmarkMarkers';
import { loadNaverMaps } from '@/features/map/lib/naverMaps';
import { splitByLeg } from '@/features/map/lib/routeSegments';

/** 경로선 두께(px) — 작은 지도라 메인 지도(7)보다 얇게 */
const STROKE_WEIGHT = 5;
/** 경로가 핀·모서리에 붙지 않도록 두는 여백(px) */
const FIT_PADDING = { top: 56, right: 28, bottom: 28, left: 28 };

interface RouteResultMapProps {
  route: RouteCandidate;
  /** 지도를 못 띄웠을 때 대신 보여줄 것 — 키가 없거나 네트워크가 끊긴 경우 */
  fallback: React.ReactNode;
}

/**
 * 지나온 경로를 실제 지도 위에 그려 보여준다(12 도착 요약).
 *
 * 메인 지도와 **같은 선·같은 마커**를 써서 안내받던 화면이 그대로 남은 것처럼 보이게 한다.
 * 조작은 막는다 — 요약을 읽는 화면이라 지도가 움직이면 방금 온 길을 잃어버린다.
 */
export function RouteResultMap({ route, fallback }: RouteResultMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<naver.maps.Map | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let created: naver.maps.Map | null = null;
    let cancelled = false;

    void loadNaverMaps().then((result) => {
      // 이펙트가 정리된 뒤 도착한 응답으로 지도를 만들면 유령 인스턴스가 남는다
      if (cancelled) return;
      if (!result.ok) {
        setFailed(true);
        return;
      }
      const container = containerRef.current;
      if (!container) return;

      const { Map, LatLng } = result.maps;
      created = new Map(container, {
        center: new LatLng(0, 0),
        zoom: 14,
        draggable: false,
        pinchZoom: false,
        scrollWheel: false,
        keyboardShortcuts: false,
        disableDoubleClickZoom: true,
        disableDoubleTapZoom: true,
        disableTwoFingerTapZoom: true,
        mapDataControl: false,
        scaleControl: false,
      });
      setMap(created);
    });

    return () => {
      cancelled = true;
      created?.destroy();
      setMap(null);
    };
  }, []);

  // 경로선 — 도보/자전거 2색. 11 경로 상세와 같은 규칙이다
  useEffect(() => {
    if (map === null) return;
    const { Polyline, LatLng } = naver.maps;
    const bikeColor = readCssToken('--color-primary');
    const lines: naver.maps.Polyline[] = [];
    const allPoints: naver.maps.LatLng[] = [];

    for (const { leg, points } of splitByLeg(route)) {
      const path = points.map(({ lat, lng }) => new LatLng(lat, lng));
      allPoints.push(...path);
      lines.push(
        new Polyline({
          map,
          path,
          strokeColor: leg.mode === 'WALK' ? WALK_COLOR : bikeColor,
          strokeWeight: STROKE_WEIGHT,
          strokeOpacity: 1,
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          clickable: false,
          zIndex: 10,
        }),
      );
    }
    // 시트가 없는 화면이라 보정 없이 여백만 두고 맞춘다
    if (allPoints.length > 0) map.fitBounds(allPoints, FIT_PADDING);

    return () => {
      for (const line of lines) line.setMap(null);
    };
  }, [map, route]);

  if (failed) return <>{fallback}</>;

  return (
    <div className="relative aspect-100/64 w-full bg-background">
      <div ref={containerRef} className="size-full" />
      {map === null ? null : <RouteLandmarkMarkers map={map} route={route} showDestination />}
    </div>
  );
}
