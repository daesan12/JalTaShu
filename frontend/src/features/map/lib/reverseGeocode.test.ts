import { describe, expect, it } from 'vitest';
import { toPickedPlace } from '@/features/map/lib/reverseGeocode';

interface ResponseParts {
  roadAddress?: string;
  jibunAddress?: string;
  /** `addition0`에 실려 오는 부가 정보 — 건물명은 `type: 'building'`일 때만이다 */
  addition?: { type: string; value: string };
}

/**
 * 응답에서 **우리가 읽는 칸만** 채운 최소 객체.
 * 실제 응답은 필드가 수십 개라 전부 채우면 무엇을 검증하는지가 가려진다.
 */
function response({ roadAddress = '', jibunAddress = '', addition }: ResponseParts) {
  return {
    v2: {
      address: { roadAddress, jibunAddress },
      results: addition === undefined ? [] : [{ land: { addition0: addition } }],
    },
  } as unknown as naver.maps.Service.ReverseGeocodeResponse;
}

const BUILDING = { type: 'building', value: '한밭도서관' };

describe('toPickedPlace', () => {
  it('건물명이 있으면 이름으로 쓰고 주소는 둘 다 그대로 넘긴다', () => {
    expect(
      toPickedPlace(
        response({
          roadAddress: '대전광역시 서구 둔산대로 117',
          jibunAddress: '대전광역시 서구 둔산동 1420',
          addition: BUILDING,
        }),
      ),
    ).toEqual({
      title: '한밭도서관',
      roadAddress: '대전광역시 서구 둔산대로 117',
      address: '대전광역시 서구 둔산동 1420',
    });
  });

  it('건물명이 없으면 도로명주소를, 그마저 없으면 지번주소를 이름으로 쓴다', () => {
    expect(
      toPickedPlace(response({ roadAddress: '대전광역시 서구 둔산대로 117' }))?.title,
    ).toBe('대전광역시 서구 둔산대로 117');
    expect(toPickedPlace(response({ jibunAddress: '대전광역시 서구 둔산동 1420' }))?.title).toBe(
      '대전광역시 서구 둔산동 1420',
    );
  });

  it('건물명 자리에 건물이 아닌 부가 정보가 오면 이름으로 쓰지 않는다', () => {
    // addition0에는 건물명 말고 우편번호 같은 것도 실려 온다
    const place = toPickedPlace(
      response({
        roadAddress: '대전광역시 서구 둔산대로 117',
        addition: { type: 'zipcode', value: '35242' },
      }),
    );
    expect(place?.title).toBe('대전광역시 서구 둔산대로 117');
  });

  it('건물명 칸이 비어 있으면 주소로 넘어간다', () => {
    const place = toPickedPlace(
      response({
        roadAddress: '대전광역시 서구 둔산대로 117',
        addition: { type: 'building', value: '' },
      }),
    );
    expect(place?.title).toBe('대전광역시 서구 둔산대로 117');
  });

  it('공백만 있는 주소는 값으로 치지 않는다', () => {
    expect(toPickedPlace(response({ roadAddress: '   ', jibunAddress: '대전 어딘가' }))).toEqual({
      title: '대전 어딘가',
      roadAddress: '',
      address: '대전 어딘가',
    });
  });

  it('쓸 값이 하나도 없으면 null이다 — 호출부가 기본 문구로 대신한다', () => {
    expect(toPickedPlace(response({}))).toBeNull();
  });
});
