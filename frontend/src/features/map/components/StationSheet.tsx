import { useState } from 'react';
import type { BikeStation } from '@/shared/api/types';
import { BottomSheet, type SnapPoint } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { toStationStatus } from '@/shared/ui/stationStatus';
import { StationForecastChart } from '@/features/map/components/StationForecastChart';
import { UpdatedBadge } from '@/features/map/components/UpdatedBadge';

/** 대여소 시트는 두 단계만 쓴다 — 요약(peek) ↔ 대수 추이까지 보이는 확장(half) */
export type StationSnap = 'peek' | 'half';

interface StationSheetProps {
  /** null이면 닫힌 상태 */
  station: BikeStation | null;
  snap: StationSnap;
  /** 대여소 목록을 마지막으로 받아온 시각 (epoch ms) — 갱신 배지에 그대로 넘긴다 */
  updatedAt: number;
  onSnapChange: (snap: StationSnap) => void;
  onClose: () => void;
  /** "반납하기" — 지금 이 대여소를 반납 대여소로 삼아 번호 입력 시트를 연다 */
  onReturn: () => void;
}

/**
 * 마커를 탭했을 때 07 위에 얹는 대여소 시트.
 * 요약만 보다가 위로 끌면 예상 대수 추이 그래프가 나온다(2-1).
 * 예측 값이 아직 없는 대여소도 있어(모델 미완성) 그래프 자리는 안내 문구로 대체한다.
 */
export function StationSheet({
  station,
  snap,
  updatedAt,
  onSnapChange,
  onClose,
  onReturn,
}: StationSheetProps) {
  // 닫히는 300ms 동안 내용이 먼저 사라지지 않도록 마지막 대여소를 들고 있는다
  const [shown, setShown] = useState(station);
  if (station !== null && station !== shown) setShown(station);

  // 공용 시트는 네 단계를 돌려주지만 여기서는 peek 아니면 확장으로만 본다
  function changeSnap(next: SnapPoint) {
    onSnapChange(next === 'peek' ? 'peek' : 'half');
  }

  const forecast = shown?.futureData ?? [];

  return (
    <BottomSheet
      open={station !== null}
      snapPoint={snap}
      onSnapChange={changeSnap}
      onClose={onClose}
      backdrop={false}
    >
      {shown === null ? null : (
        <div className="flex flex-col gap-4 pb-4">
          <div className="flex items-center justify-between gap-3 py-1">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-gray-900">{shown.name}</p>
              <p className="mt-0.5 text-sm text-gray-500">
                현재{' '}
                <span className="tabular-nums font-semibold text-gray-900">
                  {shown.currentBikes}
                </span>
                대
              </p>
            </div>
            <StatusBadge status={toStationStatus(shown.currentBikes)} className="shrink-0" />
          </div>

          {/*
            확장(half)했을 때만 그린다 — peek(110px)는 이름 줄만으로도 거의 차서
            버튼까지 넣으면 잘린다. 반납은 마커 탭 → 살짝 끌어 올리는 한 동작 더로 충분하다고 봤다
          */}
          {snap === 'half' ? (
            <section>
              <Button full variant="line" onClick={onReturn}>
                반납하기
              </Button>

              <div className="mt-4 flex items-baseline justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-gray-900">예상 대수</h2>
                <UpdatedBadge updatedAt={updatedAt} />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                시간대별로 이 대여소에 남아 있을 자전거 대수입니다.
              </p>
              <div className="mt-4">
                {forecast.length > 0 ? (
                  <StationForecastChart points={forecast} currentBikes={shown.currentBikes} />
                ) : (
                  <p className="py-8 text-center text-sm text-gray-400">
                    아직 예상 대수를 제공하지 않는 대여소입니다.
                  </p>
                )}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </BottomSheet>
  );
}
