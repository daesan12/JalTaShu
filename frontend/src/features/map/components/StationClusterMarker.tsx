import { stationMarkerSizeClass } from '@/shared/ui/stationMarkerSize';

/**
 * 07 지도에서 가까운 대여소 여러 곳을 묶은 마커.
 *
 * **상태색(여유/보통/부족)을 쓰지 않고 중립색 하나로 둔다.** 이유가 둘이다.
 * - 색이 달라야 "이건 한 대여소가 아니라 묶음"이라는 게 한눈에 읽힌다. 상태색을 쓰면
 *   개별 마커와 구분이 안 돼 숫자를 그 자리 대여소의 대수로 오해한다
 * - `toStationStatus()`는 5대 이상이면 여유로 판정하는데, 대여소 10곳을 합쳐 6대여도
 *   여유가 된다 — 사실상 전부 비어 있는 동네가 초록으로 보이는 거짓말이 된다
 *
 * 그래서 색으로 읽는 판단은 확대해서 개별 마커를 봐야 나온다. 같은 이유로 회전 지점도
 * 중립색(gray-700) 하나를 쓴다.
 *
 * 크기는 **개별 마커와 같은 규칙**(`stationMarkerSizeClass`)으로 자전거 대수에 따라 정한다.
 * 묶인 대여소 개수가 아니라 대수를 쓰는 이유는 화면에 보이는 숫자가 곧 대수이기 때문이다 —
 * 보이는 숫자와 크기가 어긋나면 크기가 무엇을 뜻하는지 읽을 수 없다.
 */

interface StationClusterMarkerProps {
  /** 묶인 대여소들의 자전거 합계. 전부 실시간 정보가 없으면 null — 0으로 바꾸지 않는다 */
  totalBikes: number | null;
}

export function StationClusterMarker({ totalBikes }: StationClusterMarkerProps) {
  return (
    <div
      className={`tabular-nums flex items-center justify-center rounded-full bg-gray-700 font-bold text-white ring-2 ring-white shadow-md ${stationMarkerSizeClass(totalBikes)}`}
    >
      {totalBikes ?? '-'}
    </div>
  );
}
