import { useEffect, useRef, useState } from 'react';
import type { BikeStation, PlaceSearchResult, Pos, RouteCandidate } from '@/shared/api/types';
import { CurrentLocationMarker } from '@/features/map/components/CurrentLocationMarker';
import { DestinationMarker } from '@/features/map/components/DestinationMarker';
import { RoutePolylines } from '@/features/map/components/RoutePolylines';
import { RouteLandmarkMarkers } from '@/features/map/components/RouteLandmarkMarkers';
import { RouteTurnMarkers } from '@/features/map/components/RouteTurnMarkers';
import { SelectedRoutePolyline } from '@/features/map/components/SelectedRoutePolyline';
import { StationMarkers } from '@/features/map/components/StationMarkers';
import { DAEJEON_CENTER, DEFAULT_ZOOM } from '@/features/map/lib/mapDefaults';
import {
  loadNaverMaps,
  subscribeMapAuthFailure,
  type MapLoadFailure,
} from '@/features/map/lib/naverMaps';

/**
 * 실패 원인별 안내 — 컴포넌트 밖에 두어 렌더마다 새로 만들지 않는다.
 *
 * 인증 실패의 구체적 원인(키 미등록 / 상품 미활성 / NCP 장애)은 화면에서 단정하지 않는다.
 * 사용자가 할 수 있는 일이 없고, SDK가 콘솔에 Error Code·Client ID·URI를 그대로 찍어 주므로
 * 개발자는 브라우저 콘솔을 보면 된다.
 */
const FAILURE_TEXT: Record<MapLoadFailure, { title: string; hint: string }> = {
  'no-key': {
    title: '지도를 표시할 수 없습니다.',
    hint: '지도 키 설정이 비어 있습니다. (.env.local의 VITE_NAVER_MAP_CLIENT_ID)',
  },
  'script-failed': {
    title: '지도를 불러오지 못했습니다.',
    hint: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  },
  'auth-failed': {
    title: '지도를 불러오지 못했습니다.',
    hint: '잠시 후 다시 시도해 주세요. 계속 같으면 문의해 주세요.',
  },
};

interface MapViewProps {
  /** 목록을 아직 못 받았으면 지도만 그린다 */
  stations: BikeStation[] | undefined;
  selectedStationId: string | null;
  onSelectStation: (stationId: string | null) => void;
  /** 08에서 고른 목적지. null이면 핀 없음 */
  destination: PlaceSearchResult | null;
  /** 10 경로 후보. null이면 경로선 없음 */
  routes: RouteCandidate[] | null;
  selectedRouteIndex: number | null;
  /**
   * 11 경로 상세에서 보고 있는 경로. null이 아니면 후보 4개 대신
   * 이 경로 하나만 도보/자전거 2색으로 그린다
   */
  detailRoute: RouteCandidate | null;
  /** 현재 위치. null이면 점을 그리지 않는다 */
  currentLocation: Pos | null;
  /** 바라보는 방향(0=북, 시계방향 度). 안내 중에만 값이 있고, 없으면 화살표를 안 그린다 */
  heading?: number | null;
  /** 값이 바뀔 때마다 현재 위치로 지도를 옮긴다(현재위치 버튼) */
  locationFocusToken: number;
  /** 경로 안내 중 — 지도가 현재 위치를 계속 따라간다 */
  followLocation: boolean;
  /** 08 "지도에서 선택" 모드 — 대여소 마커를 탭해도 대여소를 고르지 않고 그 지점으로 지도를 옮긴다 */
  pickActive: boolean;
  /**
   * 지도 인스턴스를 페이지로 올린다(사라지면 null).
   * 위치 권한을 거절했을 때 **검색을 열던 시점의 지도 중심**을 경로 출발지로 쓰기 위해서다.
   */
  onMapReady: (map: naver.maps.Map | null) => void;
}

/** 07 메인 화면의 네이버 지도 + 대여소 마커 + 목적지 핀 + 경로선 */
export function MapView({
  stations,
  selectedStationId,
  onSelectStation,
  destination,
  routes,
  selectedRouteIndex,
  detailRoute,
  currentLocation,
  heading = null,
  locationFocusToken,
  followLocation,
  pickActive,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<MapLoadFailure | null>(null);
  // 마커는 지도 인스턴스가 생긴 뒤에야 붙일 수 있어 state로 내려준다
  const [map, setMap] = useState<naver.maps.Map | null>(null);
  // 회전 지점을 찍을 경로 — 11·12에서는 고른 경로, 10에서는 지금 선택된 후보
  const shownRoute =
    detailRoute ?? (selectedRouteIndex === null ? null : (routes?.[selectedRouteIndex] ?? null));
  /**
   * 경로를 띄운 동안에는 대여소 마커를 전부 감춘다(10·11·12).
   * 대전 전역 마커가 경로선을 덮어 어디로 가는지 안 보인다 — 이때 필요한 대여소는
   * 빌릴 곳과 반납할 곳뿐이고, 그 둘은 `RouteLandmarkMarkers`가 따로 그린다.
   */
  const showStations = routes === null && detailRoute === null;

  useEffect(() => {
    let map: naver.maps.Map | null = null;
    let cancelled = false;

    void loadNaverMaps().then((result) => {
      // 이펙트가 정리된 뒤 도착한 응답으로 지도를 만들면 유령 인스턴스가 남는다
      if (cancelled) return;
      if (!result.ok) {
        setFailure(result.reason);
        return;
      }
      const container = containerRef.current;
      if (!container) return;

      const { Map, LatLng } = result.maps;
      map = new Map(container, {
        center: new LatLng(DAEJEON_CENTER.lat, DAEJEON_CENTER.lng),
        zoom: DEFAULT_ZOOM,
      });
      setMap(map);
      onMapReady(map);
    });

    return () => {
      cancelled = true;
      map?.destroy();
      setMap(null);
      onMapReady(null);
    };
    // onMapReady는 페이지의 ref에 담기만 하는 함수(useCallback)라 지도를 다시 만들 이유가 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 인증 실패는 스크립트 로드 성공 이후에 따로 통보되므로 구독이 필요하다
  useEffect(() => subscribeMapAuthFailure(() => setFailure('auth-failed')), []);

  return (
    // isolate: 네이버 SDK 내부 z-index(로고·축척)가 바텀시트 위로 튀어나오지 않게 지도 안에 가둔다
    <div className="absolute inset-0 isolate bg-background">
      {/* 실패해도 컨테이너는 유지한다 — ref가 사라지면 지도를 붙일 곳이 없어진다 */}
      <div ref={containerRef} className="size-full" />

      {map !== null && stations !== undefined && showStations ? (
        <StationMarkers
          map={map}
          stations={stations}
          selectedStationId={selectedStationId}
          onSelectStation={onSelectStation}
          pickActive={pickActive}
        />
      ) : null}

      {map !== null ? (
        <CurrentLocationMarker
          map={map}
          position={currentLocation}
          heading={heading}
          focusToken={locationFocusToken}
          follow={followLocation}
        />
      ) : null}

      {map !== null ? <DestinationMarker map={map} destination={destination} /> : null}

      {map === null ? null : detailRoute !== null ? (
        <SelectedRoutePolyline map={map} route={detailRoute} />
      ) : (
        <RoutePolylines map={map} routes={routes} selectedIndex={selectedRouteIndex} />
      )}

      {/* 회전 지점은 **지금 보고 있는 경로 하나**에만 찍는다 — 후보를 전부 찍으면 지도가 지저분해진다 */}
      {map === null ? null : <RouteTurnMarkers map={map} route={shownRoute} />}

      {/* 선택 경로의 출발·대여·반납 지점. 최종 도착은 DestinationMarker가 맡는다. */}
      {map === null ? null : <RouteLandmarkMarkers map={map} route={shownRoute} />}

      {failure === null ? null : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background px-8 text-center">
          <p className="text-sm font-medium text-gray-700">{FAILURE_TEXT[failure].title}</p>
          <p className="text-xs leading-relaxed text-gray-500">{FAILURE_TEXT[failure].hint}</p>
        </div>
      )}
    </div>
  );
}
