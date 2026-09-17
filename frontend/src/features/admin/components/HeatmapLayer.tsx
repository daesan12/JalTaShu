import { useEffect, useRef } from 'react';

/** 화면에 그릴 한 시간대의 대여소 한 곳 */
export interface HeatmapCell {
  stationId: string;
  lat: number;
  lng: number;
  /** 현재 모드 기준 건수 (통합 모드는 |대여−반납|) */
  count: number;
  /** 원 색 (hex) — 통합 모드는 유출/유입에 따라 대여소마다 다르다 */
  color: string;
}

/** 건수 → 원 반지름(m). 0건은 그리지 않으므로 최소값은 1건 기준이다 */
const MIN_RADIUS_M = 140;
const MAX_RADIUS_M = 650;

interface HeatmapLayerProps {
  map: naver.maps.Map;
  cells: HeatmapCell[];
  /** 하루 전체의 최대 건수 — 시간을 옮겨도 크기 기준이 흔들리지 않게 밖에서 계산해 준다 */
  maxCount: number;
  onSelectStation: (stationId: string) => void;
}

/**
 * 지도 위 히트맵 — 대여소마다 건수에 비례하는 반투명 원.
 * 대여소 8곳 × 원 1개 수준이라 시간대가 바뀔 때마다 전부 지우고 다시 그린다(캐싱 불필요).
 */
export function HeatmapLayer({ map, cells, maxCount, onSelectStation }: HeatmapLayerProps) {
  // 콜백이 바뀌어도 원을 다시 그리지 않는다
  const onSelectRef = useRef(onSelectStation);
  useEffect(() => {
    onSelectRef.current = onSelectStation;
  });

  useEffect(() => {
    const { Circle, LatLng, Event } = naver.maps;
    const circles: naver.maps.Circle[] = [];
    const listeners: naver.maps.MapEventListener[] = [];

    for (const cell of cells) {
      if (cell.count <= 0) continue;
      const ratio = maxCount > 0 ? Math.min(1, cell.count / maxCount) : 0;
      const circle = new Circle({
        map,
        center: new LatLng(cell.lat, cell.lng),
        radius: MIN_RADIUS_M + (MAX_RADIUS_M - MIN_RADIUS_M) * ratio,
        fillColor: cell.color,
        fillOpacity: 0.2 + 0.4 * ratio,
        strokeColor: cell.color,
        strokeOpacity: 0.7,
        strokeWeight: 1,
        clickable: true,
      });
      listeners.push(Event.addListener(circle, 'click', () => onSelectRef.current(cell.stationId)));
      circles.push(circle);
    }

    return () => {
      for (const listener of listeners) naver.maps.Event.removeListener(listener);
      for (const circle of circles) circle.setMap(null);
    };
  }, [map, cells, maxCount]);

  return null;
}
