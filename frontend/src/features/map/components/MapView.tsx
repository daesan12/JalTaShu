import { useEffect, useRef, useState } from 'react';
import type { BikeStation, PlaceSearchResult } from '@/shared/api/types';
import { DestinationMarker } from '@/features/map/components/DestinationMarker';
import { StationMarkers } from '@/features/map/components/StationMarkers';
import {
  loadNaverMaps,
  subscribeMapAuthFailure,
  type MapLoadFailure,
} from '@/features/map/lib/naverMaps';

/** 07 진입 시 초기 중심 — 대전시청 부근 */
const DAEJEON_CENTER = { lat: 36.3504, lng: 127.3845 } as const;

/** 대여소 여러 개가 한 화면에 들어오는 줌 단계 */
const DEFAULT_ZOOM = 14;

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
}

/** 07 메인 화면의 네이버 지도 + 대여소 마커 + 목적지 핀 */
export function MapView({
  stations,
  selectedStationId,
  onSelectStation,
  destination,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<MapLoadFailure | null>(null);
  // 마커는 지도 인스턴스가 생긴 뒤에야 붙일 수 있어 state로 내려준다
  const [map, setMap] = useState<naver.maps.Map | null>(null);

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
    });

    return () => {
      cancelled = true;
      map?.destroy();
      setMap(null);
    };
  }, []);

  // 인증 실패는 스크립트 로드 성공 이후에 따로 통보되므로 구독이 필요하다
  useEffect(() => subscribeMapAuthFailure(() => setFailure('auth-failed')), []);

  return (
    // isolate: 네이버 SDK 내부 z-index(로고·축척)가 바텀시트 위로 튀어나오지 않게 지도 안에 가둔다
    <div className="absolute inset-0 isolate bg-background">
      {/* 실패해도 컨테이너는 유지한다 — ref가 사라지면 지도를 붙일 곳이 없어진다 */}
      <div ref={containerRef} className="size-full" />

      {map !== null && stations !== undefined ? (
        <StationMarkers
          map={map}
          stations={stations}
          selectedStationId={selectedStationId}
          onSelectStation={onSelectStation}
        />
      ) : null}

      {map !== null ? <DestinationMarker map={map} destination={destination} /> : null}

      {failure === null ? null : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background px-8 text-center">
          <p className="text-sm font-medium text-gray-700">{FAILURE_TEXT[failure].title}</p>
          <p className="text-xs leading-relaxed text-gray-500">{FAILURE_TEXT[failure].hint}</p>
        </div>
      )}
    </div>
  );
}
