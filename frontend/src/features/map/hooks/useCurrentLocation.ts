import { useCallback, useRef, useState } from 'react';
import type { Pos } from '@/shared/api/types';

/**
 * 현재 위치 조회 — 브라우저 Geolocation API.
 * Capacitor로 감싼 뒤에는 `@capacitor/geolocation`으로 바꾼다(권한 요청 화면이 네이티브가 된다).
 * 이 파일만 고치면 되도록 화면에는 훅 결과만 노출한다.
 *
 * 위치를 못 얻어도 앱은 막히지 않는다 — 지도는 대전시청 기본값을 그대로 쓰고 안내만 띄운다.
 */

export type LocationErrorKind = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

/** 실패 원인별 안내 문구 — 사용자가 할 수 있는 일을 알려준다 */
export const LOCATION_ERROR_TEXT: Record<LocationErrorKind, string> = {
  unsupported: '이 기기에서는 현재 위치를 쓸 수 없습니다.',
  denied: '위치 권한이 꺼져 있습니다. 브라우저 설정에서 허용해 주세요.',
  unavailable: '현재 위치를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  timeout: '현재 위치를 확인하는 데 너무 오래 걸립니다. 다시 시도해 주세요.',
};

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8_000,
  // 1분 안에 받은 위치가 있으면 그대로 쓴다 — 버튼을 연달아 눌러도 매번 GPS를 켜지 않는다
  maximumAge: 60_000,
};

function toErrorKind(error: GeolocationPositionError): LocationErrorKind {
  if (error.code === error.PERMISSION_DENIED) return 'denied';
  if (error.code === error.TIMEOUT) return 'timeout';
  return 'unavailable';
}

/**
 * 조회 결과 — 실패 원인을 **돌려주는 값에 담는다**.
 * state의 `error`를 읽으면 호출한 시점의 렌더에 묶인 옛 값이 잡혀(리렌더 전) 안내 문구가 틀린다.
 */
export type LocationResult = { ok: true; position: Pos } | { ok: false; error: LocationErrorKind };

interface CurrentLocationState {
  /** 마지막으로 확인한 위치. 한 번 얻으면 다시 물어보지 않아도 쓸 수 있다 */
  position: Pos | null;
  /** 조회 중 — 버튼을 잠그고 문구를 바꾸는 용도 */
  loading: boolean;
  error: LocationErrorKind | null;
}

const INITIAL: CurrentLocationState = { position: null, loading: false, error: null };

export function useCurrentLocation() {
  const [state, setState] = useState<CurrentLocationState>(INITIAL);
  // 같은 조회가 겹치면 브라우저 권한 팝업이 여러 번 뜬다 — 진행 중인 요청을 하나로 모은다
  const pendingRef = useRef<Promise<LocationResult> | null>(null);

  /**
   * 위치를 새로 조회한다. 실패를 throw하지 않는 이유: 호출부마다 try/catch를 두는 대신
   * "있으면 쓰고 없으면 기본값"으로 잇기 위해서다.
   */
  const request = useCallback((): Promise<LocationResult> => {
    if (pendingRef.current !== null) return pendingRef.current;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ position: null, loading: false, error: 'unsupported' });
      return Promise.resolve({ ok: false, error: 'unsupported' });
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const pending = new Promise<LocationResult>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          // 백엔드 좌표 규칙에 맞춰 보관한다 — xPos=경도, yPos=위도
          const position: Pos = { xPos: coords.longitude, yPos: coords.latitude };
          setState({ position, loading: false, error: null });
          resolve({ ok: true, position });
        },
        (geoError) => {
          const error = toErrorKind(geoError);
          setState((prev) => ({ ...prev, loading: false, error }));
          resolve({ ok: false, error });
        },
        GEOLOCATION_OPTIONS,
      );
    }).finally(() => {
      pendingRef.current = null;
    });

    pendingRef.current = pending;
    return pending;
  }, []);

  /** 이미 받아둔 위치가 있으면 그대로, 없으면 새로 조회한다 */
  const ensure = useCallback((): Promise<LocationResult> => {
    if (state.position !== null) return Promise.resolve({ ok: true, position: state.position });
    return request();
  }, [state.position, request]);

  /**
   * 위치가 바뀔 때마다 계속 받는다(경로 안내 중에만 쓴다). 정리 함수를 돌려준다.
   * 평소에는 쓰지 않는다 — 계속 켜 두면 배터리를 먹고, 다른 화면은 버튼을 누른 순간의 위치만 필요하다.
   */
  const watch = useCallback((): (() => void) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ position: null, loading: false, error: 'unsupported' });
      return () => {};
    }
    const id = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setState({
          position: { xPos: coords.longitude, yPos: coords.latitude },
          loading: false,
          error: null,
        });
      },
      (geoError) => {
        // 추적 중 한 번 실패했다고 이미 받아둔 위치를 버리지 않는다 — 안내가 끊기지 않게
        setState((prev) => ({ ...prev, loading: false, error: toErrorKind(geoError) }));
      },
      GEOLOCATION_OPTIONS,
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return { ...state, request, ensure, watch };
}
