import { getSnapHeights } from '@/shared/ui/bottomSheetSnap';

/**
 * 경로가 시트·상단 컨트롤에 가리지 않도록 지도 윗부분 "띠" 안에 맞춘다.
 *
 * 네이버 `fitBounds`의 margin만으로는 부족하다 — 여백은 중심을 옮길 뿐이고, 줌 단계가 정수라
 * 띠가 좁으면(시트가 화면의 59%를 덮는 10·11) 경로가 띠보다 크게 남는다. 그래서 맞춘 뒤
 * **실제 픽셀 위치를 읽어** 필요한 만큼 한 단계씩 축소하고 띠 가운데로 민다.
 *
 * 측정은 반드시 지도가 멈춘 뒤(`idle`)에 한다. 목적지 선택 이동(`morph`)이 진행 중이면
 * `fitBounds`도 애니메이션으로 적용돼, 곧바로 읽으면 이동 중인 위치가 나온다.
 */

/** 상단 ←·목적지 이름·다시 조회 버튼이 차지하는 높이(px) */
const TOP_CONTROLS_PX = 100;
/** 시트와 경로 사이 여백(px) */
const SHEET_GAP_PX = 24;
/** 화면이 아주 낮아도 이만큼은 지도를 남긴다(px) */
const MIN_BAND_PX = 140;
/** 축소는 이 횟수까지만 — 좌표가 이상해도 무한 루프에 빠지지 않게 */
const MAX_ZOOM_OUT = 4;
/** 좌우 여백(px) */
const SIDE_PX = 40;
/** `idle`이 오지 않을 때(뷰가 그대로일 때) 보정을 실행할 시각(ms) */
const IDLE_FALLBACK_MS = 600;

/** 경로가 화면에서 차지하는 세로 범위(px). 지도 컨테이너 좌측 상단 기준 */
function verticalExtent(map: naver.maps.Map, points: naver.maps.LatLng[]) {
  const projection = map.getProjection();
  let top = Infinity;
  let bottom = -Infinity;
  for (const point of points) {
    const { y } = projection.fromCoordToOffset(point);
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  return { top, bottom };
}

function moveAboveSheet(map: naver.maps.Map, points: naver.maps.LatLng[], sheetHeight: number) {
  const mapHeight = map.getSize().height;
  const bandTop = TOP_CONTROLS_PX;
  const bandBottom = Math.max(bandTop + MIN_BAND_PX, mapHeight - sheetHeight - SHEET_GAP_PX);
  const band = bandBottom - bandTop;

  // 띠보다 크면 들어갈 때까지 한 단계씩 축소한다(줌 한 단계 = 절반). setZoom은 애니메이션 없이 즉시 반영된다
  for (let i = 0; i < MAX_ZOOM_OUT; i++) {
    const { top, bottom } = verticalExtent(map, points);
    if (bottom - top <= band) break;
    map.setZoom(map.getZoom() - 1, false);
  }

  // 띠 가운데로 옮긴다. panBy는 지도를 미는 값이라 경로가 아래로 치우쳤으면 양수가 된다
  const { top, bottom } = verticalExtent(map, points);
  const shift = Math.round((top + bottom) / 2 - (bandTop + bandBottom) / 2);
  if (shift !== 0) map.panBy(new naver.maps.Point(0, shift));
}

/**
 * 시트가 열린 상태를 감안해 경로 전체를 보여준다.
 * @param sheetHeight 열려 있는 시트 높이(px). 기본은 확장(half) 시트
 * @returns 보정 예약을 취소하는 함수 — 경로가 바뀌거나 화면을 떠날 때 호출한다
 */
export function fitPathAboveSheet(
  map: naver.maps.Map,
  points: naver.maps.LatLng[],
  sheetHeight = getSnapHeights(window.innerHeight).half,
): () => void {
  if (points.length === 0) return () => {};

  // 보정은 딱 한 번만 한다.
  // - `idle`을 기다리는 이유: 목적지 이동(`morph`)이 진행 중이면 `fitBounds`도 애니메이션으로
  //   적용돼, 곧바로 읽으면 이동 중인 위치가 나온다
  // - 리스너를 `fitBounds`보다 **먼저** 등록하는 이유: 이동이 없으면 `fitBounds`가 그 자리에서
  //   끝나며 `idle`도 같이 지나가 버린다
  // - 타이머로 한 번 더 받치는 이유: 뷰가 그대로면 `idle` 자체가 오지 않는다
  // - 보정 중의 `setZoom`·`panBy`가 `idle`을 다시 부르므로, 일하기 전에 해제해 재귀를 막는다
  let listener: naver.maps.MapEventListener | null = null;
  let timer: number | undefined;
  let done = false;

  const stop = () => {
    done = true;
    window.clearTimeout(timer);
    if (listener !== null) {
      naver.maps.Event.removeListener(listener);
      listener = null;
    }
  };

  const adjust = () => {
    if (done) return;
    stop();
    moveAboveSheet(map, points, sheetHeight);
  };

  listener = naver.maps.Event.addListener(map, 'idle', adjust);
  timer = window.setTimeout(adjust, IDLE_FALLBACK_MS);
  map.fitBounds(points, { top: TOP_CONTROLS_PX, right: SIDE_PX, bottom: SIDE_PX, left: SIDE_PX });

  return stop;
}
