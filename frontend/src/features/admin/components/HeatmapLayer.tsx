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
  /**
   * 숨김 — 지우지 않고 감춘다. 시간마다 빠지는 대여소(순증감 0)가 달라지는데, 지웠다 새로 만들면
   * 슬라이더가 느려진다
   */
  hidden?: boolean;
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
/**
 * 농도 단계 수 — 연속값 대신 단계로 끊는다. 슬라이더를 옮길 때 단계가 그대로인 원은 다시 칠하지
 * 않아도 돼서 빨라진다(네이버 원은 속성 하나를 바꿀 때마다 다시 그린다). 눈으로는 차이가 없다.
 */
const OPACITY_LEVELS = 10;

const fillOpacityOf = (level: number) =>
  MIN_OPACITY + ((MAX_OPACITY - MIN_OPACITY) * level) / OPACITY_LEVELS;
const strokeOpacityOf = (level: number) => 0.35 + (0.5 * level) / OPACITY_LEVELS;

interface CircleEntry {
  circle: naver.maps.Circle;
  listeners: naver.maps.MapEventListener[];
  visible: boolean;
  /** 지금 칠해진 색·농도 단계 — 같으면 다시 칠하지 않는다 */
  color: string;
  level: number;
}

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
 *
 * **원은 대여소마다 한 번만 만들고, 조건이 바뀌면 색·농도만 바꾼다(#159).** 예전처럼 매번 전부
 * 지우고 1,200여 개 원과 이벤트 3,700여 개를 새로 만들면, 시간 슬라이더를 옮기거나 재생할 때
 * 원이 한참 늦게 떴다. 목록에서 빠진 대여소의 원만 지우고, 새로 들어온 대여소만 만든다.
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

  /** 대여소 id → 원과 그 원의 이벤트 */
  const circlesRef = useRef(new Map<string, CircleEntry>());

  // 지도가 바뀌거나 사라질 때만 원을 모두 지운다. 줌이 바뀌면 같은 픽셀 크기가 되도록 반지름을 다시 맞춘다
  useEffect(() => {
    const circles = circlesRef.current;
    const zoomListener = naver.maps.Event.addListener(map, 'zoom_changed', () => {
      const radius = metersForPixels(map, RADIUS_PX);
      for (const { circle } of circles.values()) circle.setRadius(radius);
    });
    return () => {
      naver.maps.Event.removeListener(zoomListener);
      for (const { circle, listeners } of circles.values()) {
        for (const listener of listeners) naver.maps.Event.removeListener(listener);
        circle.setMap(null);
      }
      circles.clear();
      onHoverRef.current(null);
    };
  }, [map]);

  useEffect(() => {
    const { Circle, LatLng, Event } = naver.maps;
    const circles = circlesRef.current;
    // 반지름은 모든 원이 같다 — 원마다 계산하지 않는다
    const radius = metersForPixels(map, RADIUS_PX);
    const next = new Set<string>();

    for (const cell of cells) {
      next.add(cell.stationId);
      const ratio = maxCount > 0 ? Math.min(1, cell.count / maxCount) : 0;
      const level = Math.round(ratio * OPACITY_LEVELS);
      const visible = !cell.hidden;
      const existing = circles.get(cell.stationId);
      if (existing) {
        if (existing.visible !== visible) {
          existing.circle.setOptions('visible', visible);
          existing.visible = visible;
        }
        if (!visible) continue;
        // 바뀐 속성만 칠한다 — 한 번에 넘겨도 네이버가 속성마다 따로 다시 그려서 느리다
        if (existing.color !== cell.color) {
          existing.circle.setStyles('fillColor', cell.color);
          existing.circle.setStyles('strokeColor', cell.color);
          existing.color = cell.color;
        }
        if (existing.level !== level) {
          existing.circle.setStyles('fillOpacity', fillOpacityOf(level));
          existing.circle.setStyles('strokeOpacity', strokeOpacityOf(level));
          existing.level = level;
        }
        continue;
      }
      const center = new LatLng(cell.lat, cell.lng);
      const circle = new Circle({
        map,
        center,
        radius,
        strokeWeight: 1,
        clickable: true,
        visible,
        fillColor: cell.color,
        fillOpacity: fillOpacityOf(level),
        strokeColor: cell.color,
        strokeOpacity: strokeOpacityOf(level),
      });
      circles.set(cell.stationId, {
        circle,
        visible,
        color: cell.color,
        level,
        listeners: [
          Event.addListener(circle, 'click', () => onSelectRef.current(cell.stationId)),
          Event.addListener(circle, 'mouseover', () => {
            const { x, y } = map.getProjection().fromCoordToOffset(center);
            onHoverRef.current({ stationId: cell.stationId, x, y });
          }),
          Event.addListener(circle, 'mouseout', () => onHoverRef.current(null)),
        ],
      });
    }

    // 이번 조건에서 빠진 대여소(구·상위 100·시간대로 걸러진 곳)의 원만 지운다
    for (const [stationId, { circle, listeners }] of circles) {
      if (next.has(stationId)) continue;
      for (const listener of listeners) Event.removeListener(listener);
      circle.setMap(null);
      circles.delete(stationId);
    }
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
