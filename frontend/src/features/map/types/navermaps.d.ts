/**
 * 네이버 지도 v3 최소 타입 선언.
 *
 * `@types/navermaps`를 설치하지 않은 이유: package.json은 팀 공유 파일이라 의존성 추가에 협의가 필요하고,
 * 지금 쓰는 API가 Map·LatLng 둘뿐이다. 마커·폴리라인은 해당 이슈에서 필요한 만큼만 여기에 추가한다.
 */
declare namespace naver.maps {
  class LatLng {
    constructor(lat: number, lng: number);
    lat(): number;
    lng(): number;
  }

  interface MapOptions {
    center?: LatLng;
    zoom?: number;
  }

  class Map {
    constructor(element: HTMLElement | string, options?: MapOptions);
    /** 버전에 따라 없을 수 있어 옵셔널. 호출부는 `map.destroy?.()` 로 쓴다 */
    destroy?(): void;
  }
}

interface Window {
  naver?: typeof naver;
  /**
   * 인증 실패 시 SDK가 직접 호출하는 전역 훅.
   * 스크립트 로드는 성공해도 이 훅이 불리면 지도가 그려지지 않는다.
   */
  navermap_authFailure?: () => void;
}
