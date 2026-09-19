import { ENV } from '@/shared/config/env';

/** 지도를 띄우지 못한 이유 — 화면에 서로 다른 안내를 보여주기 위해 구분한다 */
export type MapLoadFailure =
  /** .env.local에 클라이언트 ID가 없음 (로컬 설정 누락) */
  | 'no-key'
  /** 스크립트 자체를 받지 못함 (네트워크·차단) */
  | 'script-failed'
  /** 스크립트는 받았지만 키 인증 실패 (NCP 콘솔에 현재 주소 미등록이 가장 흔함) */
  | 'auth-failed';

export type MapLoadResult =
  | { ok: true; maps: typeof naver.maps }
  | { ok: false; reason: MapLoadFailure };

const SCRIPT_URL = 'https://oapi.map.naver.com/openapi/v3/maps.js';

/**
 * 역지오코딩(`naver.maps.Service`)은 기본 번들에 없다 — 이 서브모듈을 붙여야 로드된다.
 * 08 "지도에서 선택"에서 고른 지점의 주소를 읽는 데 쓴다.
 */
const SUBMODULES = 'geocoder';

/**
 * SDK는 앱 전체에서 한 번만 받는다.
 * Promise를 모듈 스코프에 두면 StrictMode의 이펙트 2회 실행이나 화면 재진입에도
 * `<script>`가 중복으로 붙지 않는다.
 */
let loadPromise: Promise<MapLoadResult> | null = null;

/** 인증 실패는 스크립트 로드 성공 '이후'에 비동기로 통보된다 */
let authFailed = false;
const authFailureListeners = new Set<() => void>();

/**
 * 인증 실패를 구독한다. 구독 시점에 이미 실패했다면 즉시 알린다.
 * @returns 구독 해제 함수
 */
export function subscribeMapAuthFailure(listener: () => void): () => void {
  if (authFailed) listener();
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
}

export function loadNaverMaps(): Promise<MapLoadResult> {
  loadPromise ??= startLoading();
  return loadPromise;
}

function startLoading(): Promise<MapLoadResult> {
  const clientId = ENV.NAVER_MAP_CLIENT_ID;
  if (!clientId) return Promise.resolve({ ok: false, reason: 'no-key' });

  // 스크립트보다 먼저 걸어야 로드 직후 터지는 인증 실패를 놓치지 않는다
  window.navermap_authFailure = () => {
    authFailed = true;
    for (const listener of authFailureListeners) listener();
  };

  return new Promise((resolve) => {
    const script = document.createElement('script');
    // 파라미터 이름은 ncpKeyId. 구 자료의 ncpClientId는 더 이상 동작하지 않는다
    script.src = `${SCRIPT_URL}?ncpKeyId=${encodeURIComponent(clientId)}&submodules=${SUBMODULES}`;
    script.async = true;
    script.onload = () => {
      const maps = window.naver?.maps;
      resolve(maps ? { ok: true, maps } : { ok: false, reason: 'script-failed' });
    };
    script.onerror = () => {
      // 다음 진입에서 다시 시도할 수 있게 캐시를 비운다
      loadPromise = null;
      script.remove();
      resolve({ ok: false, reason: 'script-failed' });
    };
    document.head.append(script);
  });
}
