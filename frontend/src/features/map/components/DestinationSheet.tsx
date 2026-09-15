import { useState } from 'react';
import type { PlaceSearchResult } from '@/shared/api/types';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

interface DestinationSheetProps {
  /** null이면 닫힌 상태 */
  destination: PlaceSearchResult | null;
  /** "경로 찾기" 요청 중 — 버튼을 잠그고 문구를 바꾼다 */
  searching: boolean;
  onSearchRoutes: () => void;
  /** 닫기(X·스와이프) → 목적지 해제 */
  onClose: () => void;
}

/**
 * 08에서 고른 목적지를 확인하는 시트 — 네이버 지도의 장소 확인 단계.
 * 지도에 핀이 찍힌 상태에서 "이곳이 맞는지" 보고 "경로 찾기"로 넘어간다. 높이 고정(mini), 딤 없음.
 */
export function DestinationSheet({
  destination,
  searching,
  onSearchRoutes,
  onClose,
}: DestinationSheetProps) {
  // 닫히는 300ms 동안 내용이 먼저 사라지지 않도록 마지막 목적지를 들고 있는다
  const [shown, setShown] = useState(destination);
  if (destination !== null && destination !== shown) setShown(destination);

  const address = shown === null ? '' : shown.roadAddress || shown.address;

  return (
    <BottomSheet open={destination !== null} snapPoint="mini" onClose={onClose} backdrop={false}>
      {shown === null ? null : (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-gray-900">{shown.title}</p>
              {address ? <p className="mt-0.5 truncate text-sm text-gray-500">{address}</p> : null}
            </div>
            <button
              type="button"
              aria-label="목적지 해제"
              onClick={onClose}
              className="-mt-1.5 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 transition-[background-color] duration-75 active:bg-gray-100"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5">
                <path d="m7 7 10 10M17 7 7 17" {...stroke} />
              </svg>
            </button>
          </div>
          <div className="mt-auto pb-3">
            <Button full onClick={onSearchRoutes} disabled={searching}>
              {searching ? '경로 찾는 중…' : '경로 찾기'}
            </Button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
