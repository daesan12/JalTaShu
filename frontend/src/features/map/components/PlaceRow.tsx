import type { JSX } from 'react';
import type { PlaceSearchResult } from '@/shared/api/types';

type PlaceRowKind = 'result' | 'recent';

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

/** 검색 결과는 핀, 최근 검색은 시계 — Figma 08/08-1 행 아이콘과 1:1 */
const ICON: Record<PlaceRowKind, JSX.Element> = {
  result: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10Z" {...stroke} />
      <circle cx="12" cy="11" r="2.2" {...stroke} />
    </svg>
  ),
  recent: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <circle cx="12" cy="12" r="8.5" {...stroke} />
      <path d="M12 7.5V12l3 2" {...stroke} />
    </svg>
  ),
};

interface PlaceRowProps {
  place: PlaceSearchResult;
  kind: PlaceRowKind;
  onClick: () => void;
}

/** 장소 한 줄 — 이름 + 주소(도로명 우선). 거리 표시는 현재위치 이슈 이후 */
export function PlaceRow({ place, kind, onClick }: PlaceRowProps) {
  const address = place.roadAddress || place.address;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-[background-color] duration-75 active:bg-gray-50"
    >
      <span className="shrink-0 text-gray-400">{ICON[kind]}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-gray-900">{place.title}</span>
        {address ? <span className="block truncate text-sm text-gray-500">{address}</span> : null}
      </span>
    </button>
  );
}
