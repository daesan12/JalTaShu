import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Pos, TravelMode } from '@/shared/api/types';
import { posToLatLng } from '@/shared/lib/coords';

/**
 * 12 안내 중 구간별 확대 단계.
 * - 도보 17: 주변 건물·가게 이름과 다음 골목까지 보여 "이 길이 맞다"를 눈으로 확인할 수 있다.
 *   18은 가게 이름은 더 크지만 몇 걸음마다 길이 화면 밖으로 나간다(2026-09-26 실기기 비교)
 * - 자전거 16: 걷는 속도의 3~4배라 한 단계 넓게 봐야 앞 교차로가 미리 보인다
 */
const GUIDE_ZOOM: Record<TravelMode, number> = { WALK: 17, BICYCLE: 16 };

interface UseGuideZoomOptions {
  mapRef: RefObject<naver.maps.Map | null>;
  /** 12 안내 중인지 */
  active: boolean;
  /** 지금 안내 중인 구간의 이동 수단. 아직 모르면 null */
  mode: TravelMode | null;
  position: Pos | null;
}

/**
 * 안내를 시작할 때, 그리고 **이동 수단이 바뀔 때만**(도보 → 자전거 → 도보) 내 위치로 확대한다.
 *
 * 그 사이에는 건드리지 않는다 — 안내 도중 사용자가 확대·축소한 지도를 되돌리면 안 된다(#141과
 * 같은 이유). 위치는 안내를 켠 뒤에 들어오기도 하므로 위치가 올 때까지 기다린다.
 */
export function useGuideZoom({ mapRef, active, mode, position }: UseGuideZoomOptions) {
  const zoomedModeRef = useRef<TravelMode | null>(null);

  useEffect(() => {
    if (!active) {
      zoomedModeRef.current = null;
      return;
    }
    const map = mapRef.current;
    if (map === null || mode === null || position === null) return;
    if (zoomedModeRef.current === mode) return;
    zoomedModeRef.current = mode;

    const { lat, lng } = posToLatLng(position);
    map.morph(new naver.maps.LatLng(lat, lng), GUIDE_ZOOM[mode]);
  }, [mapRef, active, mode, position]);
}
