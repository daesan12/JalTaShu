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
/** "경로가 화면 안에 있다"를 볼 때 봐주는 픽셀 오차 — 반올림 차이로 튕기지 않게 */
const FITTED_TOLERANCE_PX = 2;
/** `fitBounds`를 다시 거는 횟수 상한 — 남이 계속 지도를 끌어도 무한히 붙들지 않는다 */
const MAX_REFIT = 2;

/** 경로가 화면에서 차지하는 범위(px). 지도 컨테이너 좌측 상단 기준 */
export interface PathExtent {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function pathExtent(map: naver.maps.Map, points: naver.maps.LatLng[]): PathExtent {
  const projection = map.getProjection();
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  for (const point of points) {
    const { x, y } = projection.fromCoordToOffset(point);
    if (y < top) top = y;
    if (y > bottom) bottom = y;
    if (x < left) left = x;
    if (x > right) right = x;
  }
  return { top, bottom, left, right };
}

/**
 * `fitBounds`가 **실제로 반영됐는지** — 경로 전체가 화면 안에 들어와 있으면 그렇다.
 *
 * `idle`은 "지도가 멈췄다"만 알려주고 **누가 멈췄는지는 알려주지 않는다.** 목적지 `morph`가
 * 돌고 있으면 그쪽이 우리 `fitBounds`를 덮어쓰고, 그 애니메이션이 끝나며 쏜 `idle`을 우리 것으로
 * 착각하면 목적지 확대 축척(z16)에서 재게 된다. 그러면 "경로가 너무 크다"고 판단해 억지로
 * 축소·이동하다가 경로에서 한참 떨어진 곳에 맞는다.
 *
 * 그래서 `idle`의 주인을 맞히는 대신 **결과를 본다.** `fitBounds`는 여백을 두고 경로를 화면 안에
 * 넣으므로, 적용됐다면 경로가 화면 밖으로 나가 있을 수 없다. 나가 있으면 남의 `idle`이다.
 *
 * 띠(시트 위 공간)가 아니라 **화면 전체**로 재는 것이 핵심이다 — 띠로 재면 "맞춰졌지만 시트에
 * 가린" 정상 상태와 구분할 수 없고, 그 구분이 바로 이 함수가 하는 일이다.
 */
export function isPathFitted(
  extent: PathExtent,
  size: { width: number; height: number },
  tolerance = FITTED_TOLERANCE_PX,
): boolean {
  return (
    extent.top >= -tolerance &&
    extent.left >= -tolerance &&
    extent.bottom <= size.height + tolerance &&
    extent.right <= size.width + tolerance
  );
}

function moveAboveSheet(map: naver.maps.Map, points: naver.maps.LatLng[], sheetHeight: number) {
  const mapHeight = map.getSize().height;
  const bandTop = TOP_CONTROLS_PX;
  const bandBottom = Math.max(bandTop + MIN_BAND_PX, mapHeight - sheetHeight - SHEET_GAP_PX);
  const band = bandBottom - bandTop;

  // 띠보다 크면 들어갈 때까지 한 단계씩 축소한다(줌 한 단계 = 절반). setZoom은 애니메이션 없이 즉시 반영된다
  for (let i = 0; i < MAX_ZOOM_OUT; i++) {
    const { top, bottom } = pathExtent(map, points);
    if (bottom - top <= band) break;
    map.setZoom(map.getZoom() - 1, false);
  }

  // 띠 가운데로 옮긴다. panBy는 지도를 미는 값이라 경로가 아래로 치우쳤으면 양수가 된다
  const { top, bottom } = pathExtent(map, points);
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
  // - `idle`을 기다리는 이유: 목적지 이동(`morph`)이 진행 중이면 그쪽이 우리 `fitBounds`를
  //   덮어쓰므로, 지도가 멈춘 뒤에 재야 한다
  // - 리스너를 `fitBounds`보다 **먼저** 등록하는 이유: 이동이 없으면 `fitBounds`가 그 자리에서
  //   끝나며 `idle`도 같이 지나가 버린다
  // - 타이머로 한 번 더 받치는 이유: 뷰가 그대로면 `idle` 자체가 오지 않는다
  // - 보정 중의 `setZoom`·`panBy`가 `idle`을 다시 부르므로, 일하기 전에 해제해 재귀를 막는다
  // - **`idle`을 받아도 곧바로 믿지 않는다**(`isPathFitted`): 그 `idle`이 목적지 `morph`의
  //   것이면 우리 `fitBounds`는 이미 덮어써진 뒤다. 그때는 다시 걸고 기다린다
  let listener: naver.maps.MapEventListener | null = null;
  let timer: number | undefined;
  let done = false;
  let refits = 0;

  const stop = () => {
    done = true;
    window.clearTimeout(timer);
    if (listener !== null) {
      naver.maps.Event.removeListener(listener);
      listener = null;
    }
  };

  const applyFit = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(adjust, IDLE_FALLBACK_MS);
    map.fitBounds(points, { top: TOP_CONTROLS_PX, right: SIDE_PX, bottom: SIDE_PX, left: SIDE_PX });
  };

  function adjust() {
    if (done) return;

    if (!isPathFitted(pathExtent(map, points), map.getSize())) {
      // 남의 `idle`이다 — 우리 `fitBounds`가 덮어써졌다. 상한까지만 다시 건다.
      // 상한을 넘기면 **아무것도 하지 않고 물러난다**: 덮어쓴 쪽의 화면(목적지 확대)이
      // 어색할지언정 정상 범위이고, 여기서 억지로 보정하면 경로에서 한참 떨어진 곳으로 튄다
      if (refits >= MAX_REFIT) {
        stop();
        return;
      }
      refits++;
      applyFit();
      return;
    }

    stop();
    moveAboveSheet(map, points, sheetHeight);
  }

  listener = naver.maps.Event.addListener(map, 'idle', adjust);
  applyFit();

  return stop;
}
