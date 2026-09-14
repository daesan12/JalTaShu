import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BikeStation } from '@/shared/api/types';
import { StationMarker } from '@/shared/ui/StationMarker';
import { toStationStatus } from '@/shared/ui/stationStatus';

/**
 * 마커 한 칸의 크기(px). 선택된 마커가 40px까지 커져도 anchor가 흔들리지 않게
 * 최대 크기보다 넉넉히 잡고, 터치 타깃 44px도 여기서 확보한다.
 */
const MARKER_BOX = 44;

/** 선택된 마커가 이웃 마커에 가려지지 않게 위로 올린다 */
const SELECTED_Z_INDEX = 1;

interface MarkerEntry {
  marker: naver.maps.Marker;
  /** 네이버 마커의 content 요소. React가 포털로 StationMarker를 그려 넣는다 */
  el: HTMLDivElement;
}

interface StationMarkersProps {
  map: naver.maps.Map;
  stations: BikeStation[];
  selectedStationId: string | null;
  /** 마커 탭 → 대여소 id, 지도 빈 곳 탭 → null */
  onSelectStation: (stationId: string | null) => void;
}

/**
 * 07 지도 위 대여소 마커.
 * 네이버 마커 인스턴스는 ref에 두고 대여소 목록이 바뀔 때만 만들고 지운다(갱신마다 재생성 금지).
 * 마커 안의 그림은 `StationMarker`를 포털로 렌더링해 선택 상태·대수 변화가 React 렌더로 반영된다.
 */
export function StationMarkers({
  map,
  stations,
  selectedStationId,
  onSelectStation,
}: StationMarkersProps) {
  const entriesRef = useRef(new Map<string, MarkerEntry>());
  // 포털을 붙일 요소 목록. 마커를 만든 뒤에야 알 수 있어 이펙트에서 채운다
  const [targets, setTargets] = useState<{ stationId: string; el: HTMLDivElement }[]>([]);

  // 콜백이 바뀌어도 마커 리스너를 다시 달지 않도록 이펙트 이벤트로 감싼다
  const select = useEffectEvent((stationId: string | null) => onSelectStation(stationId));

  // 대여소 목록 ↔ 마커 인스턴스 동기화
  useEffect(() => {
    const entries = entriesRef.current;
    const { Marker, LatLng, Point, Size, Event } = naver.maps;
    const seen = new Set<string>();

    for (const station of stations) {
      seen.add(station.stationId);
      const position = new LatLng(station.lat, station.lng);
      const existing = entries.get(station.stationId);
      if (existing) {
        existing.marker.setPosition(position);
        continue;
      }
      const el = document.createElement('div');
      el.className = 'flex size-11 items-center justify-center';
      const marker = new Marker({
        map,
        position,
        icon: {
          content: el,
          size: new Size(MARKER_BOX, MARKER_BOX),
          anchor: new Point(MARKER_BOX / 2, MARKER_BOX / 2),
        },
      });
      Event.addListener(marker, 'click', () => select(station.stationId));
      entries.set(station.stationId, { marker, el });
    }

    for (const [stationId, entry] of entries) {
      if (seen.has(stationId)) continue;
      entry.marker.setMap(null);
      entries.delete(stationId);
    }

    setTargets(stations.map((s) => ({ stationId: s.stationId, el: entries.get(s.stationId)!.el })));
  }, [map, stations]);

  // 지도가 바뀌거나 사라질 때 마커 전부 정리
  useEffect(() => {
    const entries = entriesRef.current;
    return () => {
      for (const entry of entries.values()) entry.marker.setMap(null);
      entries.clear();
    };
  }, [map]);

  // 지도 빈 곳 탭 → 선택 해제
  useEffect(() => {
    const listener = naver.maps.Event.addListener(map, 'click', () => select(null));
    return () => naver.maps.Event.removeListener(listener);
  }, [map]);

  useEffect(() => {
    for (const [stationId, entry] of entriesRef.current) {
      entry.marker.setZIndex(stationId === selectedStationId ? SELECTED_Z_INDEX : 0);
    }
  }, [selectedStationId, targets]);

  const stationById = useMemo(() => new Map(stations.map((s) => [s.stationId, s])), [stations]);

  return (
    <>
      {targets.map(({ stationId, el }) => {
        const station = stationById.get(stationId);
        // 목록이 바뀐 직후 이펙트가 돌기 전까지는 사라진 대여소가 잠깐 남아 있을 수 있다
        if (!station) return null;
        return createPortal(
          <StationMarker
            status={toStationStatus(station.currentBikes)}
            count={station.currentBikes}
            selected={stationId === selectedStationId}
          />,
          el,
          stationId,
        );
      })}
    </>
  );
}
