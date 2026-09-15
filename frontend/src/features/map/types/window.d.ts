/**
 * 네이버 지도 SDK가 window에 붙이는 것들.
 * `naver.maps` 자체 타입은 `@types/navermaps`(tsconfig.app.json의 types)에서 온다.
 */
interface Window {
  naver?: typeof naver;
  /**
   * 인증 실패 시 SDK가 직접 호출하는 전역 훅.
   * 스크립트 로드는 성공해도 이 훅이 불리면 지도가 그려지지 않는다.
   */
  navermap_authFailure?: () => void;
}
