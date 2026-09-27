import { useEffect, useRef } from 'react';

/** 화면에 그릴 대여소 한 곳 */
export interface HeatmapCell {
  stationId: string;
  lat: number;
  lng: number;
  /** 지금 기준(대여·반납·합계)의 건수 — 색 농도를 정한다 */
  count: number;
  /** 원 색 (hex) */
  color: string;
}

/**
 * 원 반지름(px) — **모든 대여소가 같다**(#147). 건수에 비례해 키우면 도심 원끼리 겹쳐 작은
 * 대여소가 가려졌다. 이용량은 색 농도로만 나타낸다.
 * 미터가 아니라 **화면 픽셀**로 고정한다 — 미터로 두면 대전 전체가 보이는 줌에서 지름 6px까지
 * 줄어 커서를 올릴 수 없었다. 네이버 원은 미터만 받으므로 줌이 바뀔 때마다 환산한다.
 */
const RADIUS_PX = 8;

/** 지금 줌에서 화면 `px`만큼이 몇 m인지 — 지도 가운데에서 가로로 재 환산한다 */
function metersForPixels(map: naver.maps.Map, px: number): number {
  const projection = map.getProjection();
  const center = projection.fromCoordToOffset(map.getCenter());
  const shifted = projection.fromOffsetToCoord(new naver.maps.Point(center.x + px, center.y));
  return projection.getDistance(map.getCenter(), shifted);
}

/** 0건과 최대 건수의 채움 불투명도 — 0건도 자리는 보이게 옅게 그린다 */
const MIN_OPACITY = 0.08;
const MAX_OPACITY = 0.85;

interface HeatmapLayerProps {
  map: naver.maps.Map;
  cells: HeatmapCell[];
  /** 농도 기준이 되는 최대 건수 — 지금 보이는 목록 기준으로 밖에서 계산해 준다 */
  maxCount: number;
  onSelectStation: (stationId: string) => void;
  /** 원에 커서가 올라가면 대여소와 그 자리(지도 컨테이너 기준 px), 벗어나면 null */
  onHover: (hover: { stationId: string; x: number; y: number } | null) => void;
}

/**
 * 지도 위 히트맵 — 대여소마다 같은 크기의 원을 이용량에 따라 진하게 칠한다.
 * 조건이 바뀌면 전부 지우고 다시 그린다. 1,372곳이어도 원만 그려 가볍다.
 */
export function HeatmapLayer({
  map,
  cells,
  maxCount,
  onSelectStation,
  onHover,
}: HeatmapLayerProps) {
  // 콜백이 바뀌어도 원을 다시 그리지 않는다
  const onSelectRef = useRef(onSelectStation);
  const onHoverRef = useRef(onHover);
  useEffect(() => {
    onSelectRef.current = onSelectStation;
    onHoverRef.current = onHover;
  });

  useEffect(() => {
    const { Circle, LatLng, Event } = naver.maps;
    const circles: naver.maps.Circle[] = [];
    const listeners: naver.maps.MapEventListener[] = [];

    for (const cell of cells) {
      const ratio = maxCount > 0 ? Math.min(1, cell.count / maxCount) : 0;
      const center = new LatLng(cell.lat, cell.lng);
      const circle = new Circle({
        map,
        center,
        radius: metersForPixels(map, RADIUS_PX),
        fillColor: cell.color,
        fillOpacity: MIN_OPACITY + (MAX_OPACITY - MIN_OPACITY) * ratio,
        strokeColor: cell.color,
        strokeOpacity: 0.35 + 0.5 * ratio,
        strokeWeight: 1,
        clickable: true,
      });
      listeners.push(
        Event.addListener(circle, 'click', () => onSelectRef.current(cell.stationId)),
        Event.addListener(circle, 'mouseover', () => {
          const { x, y } = map.getProjection().fromCoordToOffset(center);
          onHoverRef.current({ stationId: cell.stationId, x, y });
        }),
        Event.addListener(circle, 'mouseout', () => onHoverRef.current(null)),
      );
      circles.push(circle);
    }

    // 줌이 바뀌면 같은 픽셀 크기가 되도록 반지름을 다시 맞춘다
    listeners.push(
      Event.addListener(map, 'zoom_changed', () => {
        const radius = metersForPixels(map, RADIUS_PX);
        for (const circle of circles) circle.setRadius(radius);
      }),
    );

    return () => {
      for (const listener of listeners) naver.maps.Event.removeListener(listener);
      for (const circle of circles) circle.setMap(null);
      onHoverRef.current(null);
    };
  }, [map, cells, maxCount]);

  // 지도를 움직이면 미리보기 자리가 어긋난다 — 닫는다
  useEffect(() => {
    const listener = naver.maps.Event.addListener(map, 'bounds_changed', () =>
      onHoverRef.current(null),
    );
    return () => naver.maps.Event.removeListener(listener);
  }, [map]);

  return null;
}
