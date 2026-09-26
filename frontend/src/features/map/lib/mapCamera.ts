/**
 * 07 지도를 떠날 때의 중심·줌.
 *
 * 탭을 옮기면 `MapHomePage`가 언마운트되고 지도도 새로 만들어진다. 그때마다 기본 중심에서
 * 다시 시작하면 보던 곳을 잃으므로, 떠나는 순간의 화면을 모듈 변수에 적어 두고 돌아오면 복원한다.
 * 앱을 새로 켜면 비어 있다 — 그때만 "내 위치에서 시작"(#139)을 한다.
 */
export interface MapCamera {
  lat: number;
  lng: number;
  zoom: number;
}

let saved: MapCamera | null = null;

export function readSavedCamera(): MapCamera | null {
  return saved;
}

export function saveCamera(map: naver.maps.Map): void {
  const center = map.getCenter();
  if (!(center instanceof naver.maps.LatLng)) return;
  saved = { lat: center.lat(), lng: center.lng(), zoom: map.getZoom() };
}
