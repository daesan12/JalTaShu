import { useEffect, useRef, useState, type ReactNode } from 'react';
import { readCssToken } from '@/shared/lib/cssToken';
import { WALK_COLOR } from '@/shared/ui/grade';
import { loadNaverMaps } from '@/features/map/lib/naverMaps';

/** 경로선 두께(px) — 작은 지도라 메인 지도(7)보다 얇게 */
const STROKE_WEIGHT = 5;
/** 경로가 핀·모서리에 붙지 않도록 두는 여백(px). 핀 높이(52)만큼 위를 더 비운다 */
const DEFAULT_FIT_PADDING = { top: 56, right: 28, bottom: 28, left: 28 };

/** 지도에 그릴 구간 하나 — 도보는 파랑, 자전거는 브랜드색 */
export interface RouteMapSegment {
  mode: 'WALK' | 'BIKE';
  points: { lat: number; lng: number }[];
}

interface StaticRouteMapProps {
  segments: RouteMapSegment[];
  /** 지도를 못 띄웠을 때 대신 보여줄 것 — 키가 없거나 네트워크가 끊긴 경우 */
  fallback: ReactNode;
  /** 지도가 준비되면 그 위에 얹을 것(핀·마커). 지도 인스턴스를 받는다 */
  renderOverlay?: (map: naver.maps.Map) => ReactNode;
  /** 경로를 맞출 때 비워 둘 위쪽 여백(px) — 지도 위에 떠 있는 헤더가 있으면 그만큼 더 준다 */
  fitPaddingTop?: number;
  /** 지도 상자의 크기 클래스. 기본은 12 도착 요약의 비율 */
  sizeClassName?: string;
}

/**
 * 조작할 수 없는 작은 지도에 경로를 그려 보여준다 — 12 도착 요약과 23 기록 상세가 같이 쓴다.
 *
 * 메인 지도와 **같은 선 색**을 써서 안내받던 화면이 그대로 남은 것처럼 보이게 한다.
 * 조작은 막는다 — 요약을 읽는 화면이라 지도가 움직이면 방금 온 길을 잃어버린다.
 * 어디서 온 경로인지(경로 탐색 결과인지, 저장된 GPS 기록인지)는 모른다 — 구간 목록만 받는다.
 */
export function StaticRouteMap({
  segments,
  fallback,
  renderOverlay,
  fitPaddingTop = DEFAULT_FIT_PADDING.top,
  sizeClassName = 'aspect-100/64',
}: StaticRouteMapProps) {
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

    for (const segment of segments) {
      const path = segment.points.map(({ lat, lng }) => new LatLng(lat, lng));
      allPoints.push(...path);
      lines.push(
        new Polyline({
          map,
          path,
          strokeColor: segment.mode === 'WALK' ? WALK_COLOR : bikeColor,
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
    if (allPoints.length > 0) {
      map.fitBounds(allPoints, { ...DEFAULT_FIT_PADDING, top: fitPaddingTop });
    }

    return () => {
      for (const line of lines) line.setMap(null);
    };
  }, [map, segments, fitPaddingTop]);

  if (failed) return <>{fallback}</>;

  return (
    <div className={`relative w-full bg-background ${sizeClassName}`}>
      <div ref={containerRef} className="size-full" />
      {map === null ? null : renderOverlay?.(map)}
    </div>
  );
}
