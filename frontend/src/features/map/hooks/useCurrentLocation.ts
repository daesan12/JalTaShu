import { useCallback, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Pos } from '@/shared/api/types';

/**
 * 이 플러그인은 **타입만 배포하고 JS 진입점이 없다.** 그래서 다른 플러그인처럼
 * `import { X } from ...`이 안 되고 직접 등록해야 한다(README가 안내하는 방식).
 * 이름 문자열은 네이티브 쪽 `@CapacitorPlugin(name = ...)`과 같아야 한다.
 */
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

/**
 * 현재 위치 조회. 이 파일만 고치면 되도록 화면에는 훅 결과만 노출한다.
 *
 * - 단발 조회(`request`·`ensure`)는 브라우저 Geolocation API를 쓴다. 버튼을 누른 순간의 위치만
 *   필요하고, 앱이 화면에 떠 있는 상태라 이걸로 충분하다
 * - **계속 추적(`watch`)은 안드로이드에서 백그라운드 워처를 쓴다**(#115). 화면이 꺼지면
 *   브라우저 `watchPosition`은 멎는데, 12 안내는 그때도 계속돼야 한다
 *
 * 위치를 못 얻어도 앱은 막히지 않는다 — 지도는 대전시청 기본값을 그대로 쓰고 안내만 띄운다.
 */

export type LocationErrorKind = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

/** 실패 원인별 안내 문구 — 사용자가 할 수 있는 일을 알려준다 */
export const LOCATION_ERROR_TEXT: Record<LocationErrorKind, string> = {
  unsupported: '이 기기에서는 현재 위치를 쓸 수 없습니다.',
  denied: '위치 권한이 꺼져 있습니다. 설정에서 허용해 주세요.',
  unavailable: '현재 위치를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  timeout: '현재 위치를 확인하는 데 너무 오래 걸립니다. 다시 시도해 주세요.',
};

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8_000,
  // 1분 안에 받은 위치가 있으면 그대로 쓴다 — 버튼을 연달아 눌러도 매번 GPS를 켜지 않는다
  maximumAge: 60_000,
};

/**
 * 빠른 1차 조회 — 와이파이·기지국 위치. GPS를 잡는 몇 초 동안 화면이 멈춰 보이지 않게
 * 먼저 대략적인 자리를 보여 주고, 정밀 위치가 오면 덮어쓴다.
 * 오차가 커서 대여·반납 대여소를 고르는 데는 쓰지 않는다(`request`의 `quick` 참고).
 */
const QUICK_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 3_000,
  maximumAge: 5 * 60_000,
};

/**
 * 마지막으로 받은 위치 — 탭을 옮겨 지도가 새로 만들어져도 내 위치 점을 바로 다시 그리기 위해
 * 모듈 변수로 남긴다. 표시에만 쓰고, 새로 받기 전까지 `ensure`는 이 값을 믿지 않는다.
 */
let lastKnownPosition: Pos | null = null;

function toPos({ coords }: GeolocationPosition): Pos {
  // 백엔드 좌표 규칙에 맞춰 보관한다 — xPos=경도, yPos=위도
  return { xPos: coords.longitude, yPos: coords.latitude };
}

function toErrorKind(error: GeolocationPositionError): LocationErrorKind {
  if (error.code === error.PERMISSION_DENIED) return 'denied';
  if (error.code === error.TIMEOUT) return 'timeout';
  return 'unavailable';
}

/** 상태를 갈아끼우는 쪽 — 아래 워처 두 개가 공유한다 */
type SetLocationState = (update: (prev: CurrentLocationState) => CurrentLocationState) => void;

/**
 * 안내 중 뜨는 상시 알림 문구.
 * 안드로이드는 화면이 꺼진 앱을 재우기 때문에, 포그라운드 서비스와 이 알림이 있어야 위치가
 * 계속 온다. 알림을 숨길 방법은 없으므로(안드로이드 규칙) 왜 떠 있는지를 문구로 설명한다.
 */
const BACKGROUND_TITLE = '경로 안내 중';
const BACKGROUND_MESSAGE = '화면을 꺼도 음성 안내가 계속됩니다.';

/**
 * 알림 권한(Android 13+)을 물어본다. 이미 설치된 `@capacitor/local-notifications`로 요청한다
 * (플러그인 README가 안내하는 방법).
 *
 * **거부해도 그냥 진행한다.** 안드로이드 문서상 `POST_NOTIFICATIONS`를 거부해도 포그라운드
 * 서비스는 죽지 않는다 — 알림 드로어에서만 안 보이고 위치는 그대로 온다. 그래서 여기서
 * 막거나 되돌리지 않는다.
 */
async function askNotificationPermission(): Promise<void> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === 'prompt' || display === 'prompt-with-rationale') {
      await LocalNotifications.requestPermissions();
    }
  } catch {
    // 권한을 못 물어봐도 안내는 그대로 돈다
  }
}

/** 브라우저 추적 — 개발 중과 웹에서 쓴다. 화면이 꺼지면 멎는다 */
function watchInBrowser(setState: SetLocationState): () => void {
  const id = navigator.geolocation.watchPosition(
    (geoPosition) => {
      const position = toPos(geoPosition);
      lastKnownPosition = position;
      setState(() => ({ position, loading: false, error: null }));
    },
    (geoError) => {
      // 추적 중 한 번 실패했다고 이미 받아둔 위치를 버리지 않는다 — 안내가 끊기지 않게
      setState((prev) => ({ ...prev, loading: false, error: toErrorKind(geoError) }));
    },
    GEOLOCATION_OPTIONS,
  );
  return () => navigator.geolocation.clearWatch(id);
}

/**
 * 백그라운드 추적(안드로이드) — 화면을 꺼도 위치가 계속 온다.
 *
 * 워처를 다는 것이 비동기라 **정리가 먼저 끝날 수 있다.** 그때 늦게 생긴 워처를 안 치우면
 * 안내를 끝냈는데도 알림이 남고 GPS가 계속 돈다(`useKeepAwake`와 같은 함정).
 *
 * `requestPermissions`는 기본값 `true`라 플러그인이 위치 권한을 먼저 받고 서비스를 띄운다 —
 * Android 14의 "권한 승인 뒤에 startForeground" 순서가 이걸로 지켜진다.
 */
function watchInBackground(setState: SetLocationState): () => void {
  let cancelled = false;
  let watcherId: string | null = null;

  void askNotificationPermission();

  void BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: BACKGROUND_TITLE,
      backgroundMessage: BACKGROUND_MESSAGE,
      requestPermissions: true,
      // GPS를 잡는 동안의 옛 위치를 받지 않는다 — 안내가 지나간 지점으로 되돌아가면 안 된다
      stale: false,
    },
    (position, error) => {
      if (error !== undefined) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error.code === 'NOT_AUTHORIZED' ? 'denied' : 'unavailable',
        }));
        return;
      }
      if (position === undefined) return;
      const pos: Pos = { xPos: position.longitude, yPos: position.latitude };
      lastKnownPosition = pos;
      setState(() => ({ position: pos, loading: false, error: null }));
    },
  )
    .then((id) => {
      if (cancelled) {
        void BackgroundGeolocation.removeWatcher({ id }).catch(() => {});
        return;
      }
      watcherId = id;
    })
    .catch(() => {
      setState((prev) => ({ ...prev, loading: false, error: 'unavailable' }));
    });

  return () => {
    cancelled = true;
    if (watcherId === null) return;
    void BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
  };
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

/** 진행 중인 조회 — 정밀 결과와, 빠른 결과가 있으면 그것까지 포함한 "먼저 온 것" */
interface PendingRequest {
  precise: Promise<LocationResult>;
  first: Promise<LocationResult>;
}

export function useCurrentLocation() {
  const [state, setState] = useState<CurrentLocationState>(() => ({
    position: lastKnownPosition,
    loading: false,
    error: null,
  }));
  // 같은 조회가 겹치면 브라우저 권한 팝업이 여러 번 뜬다 — 진행 중인 요청을 하나로 모은다
  const pendingRef = useRef<PendingRequest | null>(null);
  // 이 화면에서 새로 받은 위치가 있는지. 지난번에 남긴 위치는 오래됐을 수 있어 `ensure`가 쓰지 않는다
  const freshRef = useRef(false);

  const accept = useCallback((position: Pos) => {
    lastKnownPosition = position;
    freshRef.current = true;
  }, []);

  /**
   * 위치를 새로 조회한다. 실패를 throw하지 않는 이유: 호출부마다 try/catch를 두는 대신
   * "있으면 쓰고 없으면 기본값"으로 잇기 위해서다.
   *
   * 정밀(GPS)·빠른(와이파이·기지국) 조회를 같이 건다. 빠른 쪽이 먼저 오면 점을 먼저 옮기고,
   * 정밀 위치가 오면 덮어쓴다.
   * - 기본은 **정밀 결과를 기다린다** — 대여·반납 대여소, 안내 출발 판단처럼 수십 m가 중요한 곳
   * - `quick: true`면 **먼저 온 결과로 바로 끝낸다** — 지도를 내 위치로 옮기는 것처럼 대략이면
   *   되는 곳. 정밀 위치는 뒤에서 계속 받아 점만 고친다
   */
  const request = useCallback(
    ({ quick = false }: { quick?: boolean } = {}): Promise<LocationResult> => {
      const running = pendingRef.current;
      if (running !== null) return quick ? running.first : running.precise;

      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setState({ position: null, loading: false, error: 'unsupported' });
        return Promise.resolve({ ok: false, error: 'unsupported' });
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));
      let preciseDone = false;

      const precise = new Promise<LocationResult>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (geoPosition) => {
            preciseDone = true;
            const position = toPos(geoPosition);
            accept(position);
            setState({ position, loading: false, error: null });
            resolve({ ok: true, position });
          },
          (geoError) => {
            preciseDone = true;
            const error = toErrorKind(geoError);
            setState((prev) => ({ ...prev, loading: false, error }));
            resolve({ ok: false, error });
          },
          GEOLOCATION_OPTIONS,
        );
      }).finally(() => {
        pendingRef.current = null;
      });

      const quickResult = new Promise<LocationResult | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (geoPosition) => {
            // 정밀 위치가 이미 왔으면 대략적인 값으로 되돌리지 않는다
            if (preciseDone) return resolve(null);
            const position = toPos(geoPosition);
            accept(position);
            // 기다리는 표시는 여기서 끈다 — 점이 떴으니 사용자는 더 기다리지 않아도 된다
            setState({ position, loading: false, error: null });
            resolve({ ok: true, position });
          },
          // 빠른 조회 실패는 알리지 않는다 — 정밀 조회가 결과와 실패 원인을 책임진다
          () => resolve(null),
          QUICK_GEOLOCATION_OPTIONS,
        );
      });

      const first = quickResult.then((result) => result ?? precise);
      pendingRef.current = { precise, first };
      return quick ? first : precise;
    },
    [accept],
  );

  /** 이 화면에서 받아둔 위치가 있으면 그대로, 없으면 새로 조회한다 */
  const ensure = useCallback((): Promise<LocationResult> => {
    if (state.position !== null && freshRef.current) {
      return Promise.resolve({ ok: true, position: state.position });
    }
    return request();
  }, [state.position, request]);

  /**
   * 위치가 바뀔 때마다 계속 받는다(경로 안내 중에만 쓴다). 정리 함수를 돌려준다.
   * 평소에는 쓰지 않는다 — 계속 켜 두면 배터리를 먹고, 다른 화면은 버튼을 누른 순간의 위치만 필요하다.
   *
   * 안드로이드에서는 포그라운드 서비스를 띄워 **화면이 꺼져도 계속 받는다**(#115).
   * 호출 시점이 중요하다 — 사용자가 화면을 보며 "안내 시작"을 누를 때 불려야 한다.
   * 앱이 백그라운드인 상태에서 시작하려 들면 `ACCESS_BACKGROUND_LOCATION`이 필요해진다.
   */
  const watch = useCallback((): (() => void) => {
    if (Capacitor.isNativePlatform()) return watchInBackground(setState);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ position: null, loading: false, error: 'unsupported' });
      return () => {};
    }
    return watchInBrowser(setState);
  }, []);

  return { ...state, request, ensure, watch };
}
