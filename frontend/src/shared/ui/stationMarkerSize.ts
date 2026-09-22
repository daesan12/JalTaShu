/**
 * 대수에 따른 대여소 마커 지름.
 *
 * 개별 마커(`StationMarker`)와 묶음 마커(`StationClusterMarker`)가 **같은 규칙**을 쓴다 —
 * 크기가 뜻하는 바가 둘이면 화면에서 읽을 수 없다. 숫자가 클수록 커지므로 "자전거가 많은 쪽"이
 * 숫자를 읽기 전에 크기로 먼저 보인다.
 *
 * 최대 48px이고 선택 시 `scale-110`까지 커지므로, 마커를 담는 칸(`MARKER_BOX` 56px)과
 * 묶는 격자 칸(`CELL_PX` 80px)은 그보다 넉넉해야 한다.
 *
 * 실시간 정보가 없어 대수를 모르면(`null`) 가장 작게 둔다 — 크기로 존재감을 주면
 * 모르는 값이 0대보다 중요해 보인다.
 */
export function stationMarkerSizeClass(count: number | null): string {
  if (count === null) return 'h-8 w-8 text-sm';
  if (count >= 30) return 'h-12 w-12 text-base';
  if (count >= 15) return 'h-11 w-11 text-sm';
  if (count >= 7) return 'h-10 w-10 text-sm';
  if (count >= 3) return 'h-9 w-9 text-sm';
  return 'h-8 w-8 text-sm';
}
