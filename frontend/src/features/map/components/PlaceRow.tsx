import type { JSX } from 'react';
import type { PlaceSearchResult } from '@/shared/api/types';
import { formatDistance } from '@/shared/lib/format';

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
  /** 현재 위치에서의 직선거리. 위치를 모르면 null이라 표시하지 않는다 */
  distanceM: number | null;
  onClick: () => void;
  /** kind='recent'에서만 쓴다. 없으면 삭제 버튼을 그리지 않는다 */
  onDelete?: () => void;
  /** 삭제 요청 중 — 이 행만 잠그고 흐리게 한다 */
  deleting?: boolean;
}

/**
 * 장소 한 줄 — 이름 + 주소(도로명 우선) + 현재 위치에서의 거리(+ 최근 검색이면 삭제 버튼).
 * 거리는 **직선거리**다. 실제 이동 거리는 경로를 조회해야 나오므로 고를 때 참고용으로만 쓴다.
 */
export function PlaceRow({
  place,
  kind,
  distanceM,
  onClick,
  onDelete,
  deleting = false,
}: PlaceRowProps) {
  const address = place.roadAddress || place.address;
  return (
    <div
      className={`flex min-h-14 w-full items-center transition-opacity duration-150 ${deleting ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={deleting}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left transition-[background-color] duration-75 active:bg-gray-50 disabled:pointer-events-none"
      >
        <span className="shrink-0 text-gray-400">{ICON[kind]}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-gray-900">
            {place.title}
          </span>
          {address ? <span className="block truncate text-sm text-gray-500">{address}</span> : null}
        </span>
        {distanceM === null ? null : (
          <span className="shrink-0 text-sm tabular-nums text-gray-400">
            {formatDistance(distanceM)}
          </span>
        )}
      </button>
      {onDelete ? (
        <button
          type="button"
          aria-label={`${place.title} 최근 검색에서 삭제`}
          onClick={(e) => {
            // 행 버튼(장소 선택)까지 같이 눌리지 않게 막는다
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 transition-[background-color] duration-75 active:bg-gray-100 disabled:pointer-events-none"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
            <path
              d="m7 7 10 10M17 7 7 17"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
      ) : (
        <div className="w-2 shrink-0" />
      )}
    </div>
  );
}
