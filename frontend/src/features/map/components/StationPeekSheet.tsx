import { useState } from 'react';
import type { BikeStation } from '@/shared/api/types';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { toStationStatus } from '@/shared/ui/stationStatus';

interface StationPeekSheetProps {
  /** null이면 닫힌 상태 */
  station: BikeStation | null;
  onClose: () => void;
}

/**
 * 마커를 탭했을 때 07 위에 얹는 대여소 요약 시트 — 이름과 현재 대수만.
 * 대수 추이 그래프(half 단계)는 후속 이슈라 `onSnapChange`를 넘기지 않아 위로 끌리지 않는다.
 */
export function StationPeekSheet({ station, onClose }: StationPeekSheetProps) {
  // 닫히는 300ms 동안 내용이 먼저 사라지지 않도록 마지막 대여소를 들고 있는다
  const [shown, setShown] = useState(station);
  if (station !== null && station !== shown) setShown(station);

  return (
    <BottomSheet open={station !== null} snapPoint="peek" onClose={onClose} backdrop={false}>
      {shown === null ? null : (
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900">{shown.name}</p>
            <p className="mt-0.5 text-sm text-gray-500">
              현재{' '}
              <span className="tabular-nums font-semibold text-gray-900">{shown.currentBikes}</span>
              대
            </p>
          </div>
          <StatusBadge status={toStationStatus(shown.currentBikes)} className="shrink-0" />
        </div>
      )}
    </BottomSheet>
  );
}
