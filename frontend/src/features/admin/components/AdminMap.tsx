import { useEffect, useRef, useState } from 'react';
import {
  loadNaverMaps,
  subscribeMapAuthFailure,
  type MapLoadFailure,
} from '@/features/map/lib/naverMaps';

/** 대전 도심(시청 인근) — 히트맵 기본 화면 */
const DAEJEON_CENTER = { lat: 36.3535, lng: 127.385 };
const DEFAULT_ZOOM = 12;

/**
 * 더 축소하지 못하게 막는 한계. 대전 밖은 대여소가 없어 빈 지도만 넓어진다.
 * 대여소 분포가 남북 24.6km·동서 17.3km인데 지도 칸이 가로로 길어 **세로가 제약**이다.
 * 줌 11이면 세로로 약 34km가 들어와 대전 전체가 여유 있게 담긴다(줌 12는 세로 17km라 잘린다).
 */
const MIN_ZOOM = 11;

/**
 * 지도를 끌어서 벗어날 수 있는 한계. 대여소가 대전에만 있어 밖으로 나가면 빈 지도뿐이다.
 *
 * ⚠ 실측(2026-09-22): 네이버 `maxBounds`는 문서 설명("보이는 최대 경계")과 달리
 * **중심을 경계 안에 가두고, 경계보다 넓어지는 줌 아웃도 함께 막는다.**
 * 그래서 경계 크기가 `MIN_ZOOM`을 덮어쓴다 — 좁게 잡으면 줌 11에 도달하지 못한다.
 *
 * 대여소 범위(남북 24.6km·동서 17.3km)로 좁히면 이동은 대전 안에 갇히지만 줌 12에서 막혀
 * **대전 전체를 한 화면에 못 본다.** 히트맵은 도시 전체 흐름을 보는 화면이라
 * 전체 보기를 살리기로 했다(2026-09-22 결정).
 *
 * 그래서 경계는 "줌 11 뷰포트가 들어가는 최소 크기"로 잡는다. 1920 너비 기준이며,
 * 중심이 경계 끝까지 갈 수 있으므로 **최대 50km 남짓 벗어날 수 있다**(공주·홍성 방면).
 * 전국을 떠도는 것은 막고, 그 이상 조이면 줌 11이 죽는다.
 */
const PAN_BOUNDS = { south: 36.1, west: 126.8, north: 36.63, east: 127.98 };

const FAILURE_MESSAGE: Record<MapLoadFailure, string> = {
  'no-key': '.env.local에 VITE_NAVER_MAP_CLIENT_ID가 없습니다.',
  'script-failed': '지도 스크립트를 불러오지 못했습니다. 네트워크를 확인해 주세요.',
  'auth-failed': '지도 키 인증에 실패했습니다. NCP 콘솔에 현재 주소가 등록됐는지 확인해 주세요.',
};

interface AdminMapProps {
  /** 지도 인스턴스가 준비되면 호출 — 부모가 이 map으로 오버레이를 그린다 */
  onReady: (map: naver.maps.Map) => void;
}

/**
 * 관리자 전용 지도 껍데기 — SDK 로더(`loadNaverMaps`)만 모바일과 공유한다.
 * 모바일 MapView는 길안내 전용 props(경로선·시트 연동)가 딸려 와서 재사용하지 않는다(인수인계 규칙).
 */
export function AdminMap({ onReady }: AdminMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<MapLoadFailure | null>(null);

  // onReady가 바뀌어도 지도를 다시 만들지 않도록 ref로 최신 값만 읽는다
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  });

  useEffect(() => {
    let cancelled = false;
    let map: naver.maps.Map | null = null;

    void loadNaverMaps().then((result) => {
      // 언마운트 후 도착한 응답으로 유령 인스턴스를 만들지 않는다
      if (cancelled || !containerRef.current) return;
      if (!result.ok) {
        setFailure(result.reason);
        return;
      }
      map = new result.maps.Map(containerRef.current, {
        center: new result.maps.LatLng(DAEJEON_CENTER.lat, DAEJEON_CENTER.lng),
        zoom: DEFAULT_ZOOM,
        minZoom: MIN_ZOOM,
        maxBounds: new result.maps.LatLngBounds(
          new result.maps.LatLng(PAN_BOUNDS.south, PAN_BOUNDS.west),
          new result.maps.LatLng(PAN_BOUNDS.north, PAN_BOUNDS.east),
        ),
      });
      onReadyRef.current(map);
    });

    const unsubscribe = subscribeMapAuthFailure(() => setFailure('auth-failed'));
    return () => {
      cancelled = true;
      unsubscribe();
      map?.destroy();
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {failure && (
        <div className="absolute inset-0 flex items-center justify-center bg-admin-panel">
          <p className="max-w-md text-center text-sm text-admin-muted">
            {FAILURE_MESSAGE[failure]}
          </p>
        </div>
      )}
    </div>
  );
}
