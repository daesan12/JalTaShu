import type { LatLng } from '@/shared/lib/coords';

/**
 * 08 "지도에서 선택"에서 고른 지점의 표시 정보 — `PlaceSearchResult`의 이름·주소 칸을 채운다.
 * 검색으로 고른 장소와 같은 모양이라 목적지 확인 시트를 고치지 않고 그대로 쓴다.
 */
export interface PickedPlace {
  /** 화면에 크게 보여줄 이름 — 건물명 → 도로명주소 → 지번주소 순으로 고른다 */
  title: string;
  /** 지번 주소. 없으면 빈 문자열 */
  address: string;
  /** 도로명 주소. 없으면 빈 문자열 */
  roadAddress: string;
}

/**
 * 도로명 결과에 딸려 오는 건물명을 꺼낸다.
 * 네이버 역지오코딩은 **주소가 기준**이라 건물명은 `addition0`에 얹혀 올 때만 있다.
 * (빈 땅·도로 위를 찍으면 당연히 없다 — 없는 게 정상이므로 호출부가 주소로 대신한다)
 */
function buildingName(results: naver.maps.Service.ResultItem[]): string {
  for (const item of results) {
    const addition = item.land?.addition0;
    if (addition?.type === 'building' && addition.value) return addition.value;
  }
  return '';
}

/**
 * 역지오코딩 응답 → 화면에 쓸 이름·주소.
 * 쓸 만한 값이 하나도 없으면 null을 준다(호출부가 "지도에서 선택한 위치"로 대신한다).
 *
 * SDK 응답에서 바로 꺼낼 수 있는 순수 함수로 떼어 두었다 — 지도 없이 fallback 순서를 검증하기 위해서다.
 */
export function toPickedPlace(response: naver.maps.Service.ReverseGeocodeResponse): PickedPlace | null {
  const address = response.v2?.address;
  const roadAddress = address?.roadAddress?.trim() ?? '';
  const jibunAddress = address?.jibunAddress?.trim() ?? '';
  const title = buildingName(response.v2?.results ?? []) || roadAddress || jibunAddress;
  if (!title) return null;
  return { title, address: jibunAddress, roadAddress };
}

/**
 * 좌표 → 건물명·주소. 실패하면 null이다.
 *
 * 실패를 예외로 올리지 않는 것은 의도다 — 주소를 못 읽어도 **위치 선택 자체는 되어야** 한다.
 * (geocoder 서브모듈 미로드, NCP 콘솔에서 Geocoding 미활성, 바다·국외처럼 주소가 없는 지점)
 *
 * 브라우저가 네이버 SDK를 직접 호출하므로 msw 목업 대상이 아니다.
 */
export function reverseGeocode({ lat, lng }: LatLng): Promise<PickedPlace | null> {
  const service = window.naver?.maps?.Service;
  // 서브모듈이 없으면 함수 자체가 없다 — 호출하면 TypeError라 미리 막는다
  if (typeof service?.reverseGeocode !== 'function') return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      service.reverseGeocode(
        {
          coords: new naver.maps.LatLng(lat, lng),
          // 도로명을 먼저 요청해야 건물명이 딸려 온다. 도로명이 없는 지점을 위해 지번도 함께 받는다
          orders: [service.OrderType.ROAD_ADDR, service.OrderType.ADDR].join(','),
        },
        (status, response) => {
          resolve(status === service.Status.OK ? toPickedPlace(response) : null);
        },
      );
    } catch {
      resolve(null);
    }
  });
}
