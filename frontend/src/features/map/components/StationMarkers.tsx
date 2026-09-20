import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BikeStation } from '@/shared/api/types';
import { StationMarker } from '@/shared/ui/StationMarker';
import { toStationStatus } from '@/shared/ui/stationStatus';
import { StationClusterMarker } from '@/features/map/components/StationClusterMarker';
import {
  CLUSTER_MAX_ZOOM,
  clusterStations,
  type StationCluster,
} from '@/features/map/lib/stationClusters';

/**
 * 마커 한 칸의 크기(px). 가장 큰 마커(30대 이상 = 48px, 선택 시 scale-110으로 53px)보다
 * 넉넉히 잡아 크기가 바뀌어도 anchor가 흔들리지 않게 하고, 터치 타깃 44px도 여기서 확보한다.
 */
const MARKER_BOX = 56;

/** 선택된 마커가 이웃 마커에 가려지지 않게 위로 올린다 */
const SELECTED_Z_INDEX = 1;

/** 묶음을 탭해 확대할 때의 상한. 겹쳐 있는 대여소에서 빈 화면까지 파고들지 않게 막는다 */
const TAP_ZOOM_LIMIT = CLUSTER_MAX_ZOOM + 1;

/** 묶음을 확대할 때 가장자리에 남길 여백(px) */
const TAP_FIT_PADDING = 80;

interface MarkerEntry {
  marker: naver.maps.Marker;
  /** 네이버 마커의 content 요소. React가 포털로 마커 그림을 그려 넣는다 */
  el: HTMLDivElement;
}

/** 지도에 찍을 것 하나 — 대여소 한 곳이거나, 여러 곳을 묶은 무리 */
type MarkerItem =
  | { key: string; lat: number; lng: number; kind: 'station'; station: BikeStation }
  | { key: string; lat: number; lng: number; kind: 'cluster'; cluster: StationCluster };

interface StationMarkersProps {
  map: naver.maps.Map;
  stations: BikeStation[];
  selectedStationId: string | null;
  /** 마커 탭 → 대여소 id, 지도 빈 곳 탭 → null */
  onSelectStation: (stationId: string | null) => void;
  /**
   * 08 "지도에서 선택" 모드 — 마커를 탭해도 대여소를 고르지 않고 그 자리로 지도를 옮긴다.
   * 마커가 지도 클릭을 가로채는 탓에, 이걸 안 하면 대여소 위에서는 핀이 움직이지 않는다.
   */
  pickActive: boolean;
}

/**
 * 07 지도 위 대여소 마커.
 *
 * 축소했을 때는 가까운 대여소를 묶어 자전거 합계 하나로 보여준다(`clusterStations`).
 * 묶음은 위경도 격자로 정해지므로 지도를 끌 때는 그대로고 **줌이 바뀔 때만** 다시 계산한다.
 *
 * 네이버 마커 인스턴스는 ref에 두고 찍을 것이 바뀔 때만 만들고 지운다(갱신마다 재생성 금지).
 * 마커 안의 그림은 포털로 렌더링해 선택 상태·대수 변화가 React 렌더로 반영된다.
 */
export function StationMarkers({
  map,
  stations,
  selectedStationId,
  onSelectStation,
  pickActive,
}: StationMarkersProps) {
  const entriesRef = useRef(new Map<string, MarkerEntry>());
  // 포털을 붙일 요소 목록. 마커를 만든 뒤에야 알 수 있어 이펙트에서 채운다
  const [targets, setTargets] = useState<{ key: string; el: HTMLDivElement }[]>([]);
  const [zoom, setZoom] = useState(() => map.getZoom());

  // 콜백이 바뀌어도 마커 리스너를 다시 달지 않도록 이펙트 이벤트로 감싼다
  const select = useEffectEvent((stationId: string | null) => onSelectStation(stationId));

  useEffect(() => {
    const listener = naver.maps.Event.addListener(map, 'zoom_changed', () => setZoom(map.getZoom()));
    return () => naver.maps.Event.removeListener(listener);
  }, [map]);

  const items = useMemo<MarkerItem[]>(() => {
    const { clusters, singles } = clusterStations(stations, zoom, selectedStationId);
    return [
      ...clusters.map(
        (cluster): MarkerItem => ({
          key: `c:${cluster.key}`,
          lat: cluster.lat,
          lng: cluster.lng,
          kind: 'cluster',
          cluster,
        }),
      ),
      ...singles.map(
        (station): MarkerItem => ({
          key: `s:${station.stationId}`,
          lat: station.lat,
          lng: station.lng,
          kind: 'station',
          station,
        }),
      ),
    ];
  }, [stations, zoom, selectedStationId]);

  const itemByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items]);

  /**
   * 마커 탭.
   * - 선택 모드에서는 지도를 그 자리로 옮겨 중앙 핀이 거기 놓이게 한다
   * - 묶음은 묶인 대여소가 다 보이게 확대한다
   *
   * 리스너는 마커를 만들 때 한 번만 달고 key로 지금 값을 다시 찾는다 — 만들 때 잡은 값을
   * 그대로 쓰면 대여소 목록이 갱신된 뒤 옛 좌표로 확대한다.
   */
  const tapMarker = useEffectEvent((key: string) => {
    const item = itemByKey.get(key);
    if (!item) return;
    if (pickActive) {
      map.panTo(new naver.maps.LatLng(item.lat, item.lng));
      return;
    }
    if (item.kind === 'station') {
      onSelectStation(item.station.stationId);
      return;
    }
    // fitBounds는 애니메이션 없이 즉시 반영된다 — 바로 읽어 상한을 넘겼으면 되돌린다
    map.fitBounds(
      item.cluster.stations.map((s) => new naver.maps.LatLng(s.lat, s.lng)),
      { top: TAP_FIT_PADDING, right: TAP_FIT_PADDING, bottom: TAP_FIT_PADDING, left: TAP_FIT_PADDING },
    );
    if (map.getZoom() > TAP_ZOOM_LIMIT) map.setZoom(TAP_ZOOM_LIMIT);
  });

  // 찍을 것 ↔ 마커 인스턴스 동기화
  useEffect(() => {
    const entries = entriesRef.current;
    const { Marker, LatLng, Point, Size, Event } = naver.maps;
    const seen = new Set<string>();

    for (const item of items) {
      seen.add(item.key);
      const position = new LatLng(item.lat, item.lng);
      const existing = entries.get(item.key);
      if (existing) {
        existing.marker.setPosition(position);
        continue;
      }
      const el = document.createElement('div');
      el.className = 'flex size-14 items-center justify-center';
      const marker = new Marker({
        map,
        position,
        icon: {
          content: el,
          size: new Size(MARKER_BOX, MARKER_BOX),
          anchor: new Point(MARKER_BOX / 2, MARKER_BOX / 2),
        },
      });
      Event.addListener(marker, 'click', () => tapMarker(item.key));
      entries.set(item.key, { marker, el });
    }

    for (const [key, entry] of entries) {
      if (seen.has(key)) continue;
      entry.marker.setMap(null);
      entries.delete(key);
    }

    setTargets(items.map((item) => ({ key: item.key, el: entries.get(item.key)!.el })));
  }, [map, items]);

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
    const selectedKey = selectedStationId === null ? null : `s:${selectedStationId}`;
    for (const [key, entry] of entriesRef.current) {
      entry.marker.setZIndex(key === selectedKey ? SELECTED_Z_INDEX : 0);
    }
  }, [selectedStationId, targets]);

  return (
    <>
      {targets.map(({ key, el }) => {
        const item = itemByKey.get(key);
        // 목록이 바뀐 직후 이펙트가 돌기 전까지는 사라진 마커가 잠깐 남아 있을 수 있다
        if (!item) return null;
        return createPortal(
          item.kind === 'cluster' ? (
            <StationClusterMarker totalBikes={item.cluster.totalBikes} />
          ) : (
            <StationMarker
              status={toStationStatus(item.station.currentBikes)}
              count={item.station.currentBikes}
              selected={item.station.stationId === selectedStationId}
            />
          ),
          el,
          key,
        );
      })}
    </>
  );
}
