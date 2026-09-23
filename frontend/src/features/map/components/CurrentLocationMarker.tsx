import { useEffect, useRef } from 'react';
import type { Pos } from '@/shared/api/types';
import { posToLatLng } from '@/shared/lib/coords';

/** 내 위치 하나가 화면에 크게 들어오는 줌 단계 — 목적지 핀과 같은 값 */
const CURRENT_LOCATION_ZOOM = 16;

/** 화살표까지 담는 마커 크기 — 점(22px) 바깥으로 화살표가 나가야 해서 더 크다 */
const MARKER_SIZE = 44;

/**
 * 내 위치 점 — 지도 앱 관례대로 파란 점에 흰 테두리, 바깥은 옅은 원.
 * 점 위에 **바라보는 방향 화살표**를 붙인다. 방향을 모르면 화살표만 감추고 점은 그대로 둔다.
 * 네이버 마커 content는 DOM 문자열을 받고 페이지 안에서 그려지므로 Tailwind 클래스가 그대로 먹는다
 * (목적지 핀도 같은 방식). 정확도 반경 원은 그리지 않는다.
 *
 * ⚠ 클래스는 **문자열 그대로** 적는다 — Tailwind 4는 소스에서 찾은 문자열만 CSS로 내보내므로
 * `h-[${MARKER_SIZE}px]`처럼 조합하면 그 클래스가 만들어지지 않는다. 크기를 바꾸면 여기와 상수를 같이 고친다.
 */
const DOT_HTML = `<span class="relative block h-[44px] w-[44px]" aria-hidden="true"><span data-heading class="absolute inset-0 hidden origin-center transition-[rotate] duration-200 ease-out"><span class="absolute top-0 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[6px] border-b-[9px] border-x-transparent border-b-blue-600"></span></span><span class="absolute top-1/2 left-1/2 block h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2"><span class="absolute inset-0 rounded-full bg-blue-600/20"></span><span class="absolute inset-[5px] rounded-full bg-blue-600 ring-2 ring-white"></span></span></span>`;

interface CurrentLocationMarkerProps {
  map: naver.maps.Map;
  /** null이면 점을 지운다 */
  position: Pos | null;
  /**
   * 이 값이 바뀔 때마다 그 위치로 지도를 옮긴다.
   * 좌표가 같아도(같은 자리에서 버튼을 다시 눌러도) 다시 이동해야 해서 좌표와 따로 둔다.
   */
  focusToken: number;
  /**
   * true면 위치가 바뀔 때마다 지도가 따라간다(경로 안내 중에만).
   * 평소에는 false — 위치가 갱신됐다고 보고 있던 지도가 멋대로 움직이면 안 된다.
   */
  follow?: boolean;
  /** 바라보는 방향(0=북, 시계방향 度). null이면 화살표를 감춘다 */
  heading?: number | null;
}

/** 현재 위치를 지도에 점으로 찍고, 버튼을 누를 때마다 그 위치로 이동한다 */
export function CurrentLocationMarker({
  map,
  position,
  focusToken,
  follow = false,
  heading = null,
}: CurrentLocationMarkerProps) {
  const markerRef = useRef<naver.maps.Marker | null>(null);

  useEffect(() => {
    if (position === null) {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      return;
    }
    const { lat, lng } = posToLatLng(position);
    const point = new naver.maps.LatLng(lat, lng);

    if (markerRef.current === null) {
      markerRef.current = new naver.maps.Marker({
        map,
        position: point,
        title: '현재 위치',
        icon: {
          content: DOT_HTML,
          size: new naver.maps.Size(MARKER_SIZE, MARKER_SIZE),
          anchor: new naver.maps.Point(MARKER_SIZE / 2, MARKER_SIZE / 2),
        },
        // 평소에는 대여소 마커·목적지 핀보다 아래 — 내 위치는 배경 정보다
        zIndex: 1,
        clickable: false,
      });
    } else {
      markerRef.current.setPosition(point);
    }

    /*
     * 안내 중에는 내 위치를 맨 위로 올린다 — 출발 핀(zIndex 3)이 정확히 같은 자리에 찍혀
     * 점과 방향 화살표를 덮어버린다. 길을 따라갈 때 가장 중요한 건 내가 어디서 어딜 보는지다.
     */
    markerRef.current.setZIndex(follow ? 4 : 1);

    // 안내 중에는 지도가 따라간다. 애니메이션 없이 옮겨 위치가 자주 올 때 이동이 밀리지 않게 한다
    if (follow) map.setCenter(point);
  }, [map, position, follow]);

  /*
   * 화살표는 마커를 다시 만들지 않고 DOM을 직접 돌린다 — setIcon으로 갈아끼우면 방향이 바뀔 때마다
   * 마커가 새로 그려져 점이 깜빡인다.
   */
  useEffect(() => {
    const arrow = markerRef.current?.getElement()?.querySelector<HTMLElement>('[data-heading]');
    if (!arrow) return;
    if (heading === null) {
      arrow.classList.add('hidden');
      return;
    }
    arrow.classList.remove('hidden');
    arrow.style.rotate = `${heading}deg`;
  }, [heading, position]);

  // 버튼을 누른 순간에만 이동한다. 위치 갱신만으로 지도가 멋대로 움직이지 않게 분리했다
  useEffect(() => {
    if (focusToken === 0 || position === null) return;
    const { lat, lng } = posToLatLng(position);
    map.morph(new naver.maps.LatLng(lat, lng), CURRENT_LOCATION_ZOOM);
  }, [map, focusToken, position]);

  useEffect(() => {
    return () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
    };
  }, [map]);

  return null;
}
