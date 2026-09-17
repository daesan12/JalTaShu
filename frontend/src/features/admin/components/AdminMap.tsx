import { useEffect, useRef, useState } from 'react';
import {
  loadNaverMaps,
  subscribeMapAuthFailure,
  type MapLoadFailure,
} from '@/features/map/lib/naverMaps';

/** 대전 도심(시청 인근) — 히트맵 기본 화면 */
const DAEJEON_CENTER = { lat: 36.3535, lng: 127.385 };
const DEFAULT_ZOOM = 12;

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
