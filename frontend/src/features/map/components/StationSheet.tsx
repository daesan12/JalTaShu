import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BikeStation } from '@/shared/api/types';
import { formatTimeAgo } from '@/shared/lib/format';
import { BottomSheet, type SnapPoint } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { toStationStatus } from '@/shared/ui/stationStatus';
import { bikeStationDetailKey, getBikeStationDetail } from '@/features/map/api/stations';
import { StationForecastChart } from '@/features/map/components/StationForecastChart';

/** 대여소 시트는 두 단계만 쓴다 — 요약(peek) ↔ 대수 추이가 보이는 확장(half) */
export type StationSnap = 'peek' | 'half';

interface StationSheetProps {
  /** null이면 닫힌 상태 */
  station: BikeStation | null;
  snap: StationSnap;
  onSnapChange: (snap: StationSnap) => void;
  onClose: () => void;
  /** "반납하기" — 지금 이 대여소를 반납 대여소로 삼아 번호 입력 시트를 연다 */
  onReturn: () => void;
}

/**
 * 마커를 탭했을 때 07 위에 얹는 대여소 시트.
 * 요약만 보다가 위로 끌면 예상 대수 추이 그래프가 나온다(2-1).
 * 예상 대수는 목록이 아니라 **상세 API**에만 있어서, 확장했을 때만 그 대여소 하나를 부른다.
 */
export function StationSheet({
  station,
  snap,
  onSnapChange,
  onClose,
  onReturn,
}: StationSheetProps) {
  // 닫히는 300ms 동안 내용이 먼저 사라지지 않도록 마지막 대여소를 들고 있는다
  const [shown, setShown] = useState(station);
  if (station !== null && station !== shown) setShown(station);

  // 스냅은 손을 뗀 뒤에야 바뀐다 — 끌어올리는 동안에도 펼친 모습이 따라 올라오도록 드래그를 함께 본다
  const [dragging, setDragging] = useState(false);
  const showDetail = (snap === 'half' || dragging) && station !== null;

  const {
    data: detail,
    isPending: detailPending,
    isError: detailFailed,
  } = useQuery({
    queryKey: bikeStationDetailKey(shown?.stationId ?? ''),
    queryFn: () => getBikeStationDetail(shown!.stationId),
    // 시트를 여는 순간 미리 받아 둔다 — 끌어올리는 짧은 사이에 그래프가 준비돼 있어야
    // 손을 뗀 뒤 "불러오는 중"이 번쩍이지 않는다 (대여소 한 건짜리 조회다)
    enabled: station !== null && shown !== null,
  });

  // 공용 시트는 네 단계를 돌려주지만 여기서는 peek 아니면 확장으로만 본다
  function changeSnap(next: SnapPoint) {
    onSnapChange(next === 'peek' ? 'peek' : 'half');
  }

  const forecast = detail?.futureData ?? [];
  // 상세를 이미 받았으면 그쪽 대수가 더 최신이다
  const currentBikes = detail?.currentBikes ?? shown?.currentBikes ?? null;
  const measuredAt = detail?.updatedAt ?? shown?.updatedAt ?? null;

  return (
    <BottomSheet
      open={station !== null}
      snapPoint={snap}
      onSnapChange={changeSnap}
      onClose={onClose}
      backdrop={false}
      onDraggingChange={setDragging}
    >
      {shown === null ? null : (
        <div className="flex flex-col gap-4 pb-4">
          <div className="flex items-center justify-between gap-3 py-1">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-gray-900">{shown.name}</p>
              <p className="mt-0.5 text-sm text-gray-500">
                {currentBikes === null ? (
                  '실시간 정보 없음'
                ) : (
                  <>
                    현재{' '}
                    <span className="tabular-nums font-semibold text-gray-900">{currentBikes}</span>
                    대
                  </>
                )}
                {/* 이 대수가 몇 시 기준인지 — 서버가 준 관측 시각(time)이다 */}
                {measuredAt === null ? null : (
                  <span className="text-gray-400"> · {formatTimeAgo(measuredAt)} 기준</span>
                )}
              </p>
            </div>
            <StatusBadge status={toStationStatus(currentBikes)} className="shrink-0" />
          </div>

          {/*
            peek에서는 그리지 않는다 — 110px는 이름 줄만으로도 거의 차서 버튼이 반쯤 잘려 보인다.
            대신 **드래그가 시작되면 바로** 그려서, 끌어올리는 동안 이 내용이 그대로 따라 올라온다
          */}
          {showDetail ? (
            <section>
              <Button full variant="line" onClick={onReturn}>
                반납하기
              </Button>

              <h2 className="mt-4 text-[15px] font-semibold text-gray-900">예상 대수</h2>
              <p className="mt-1 text-xs text-gray-500">
                시간대별로 이 대여소에 남아 있을 자전거 대수입니다.
              </p>
              <div className="mt-4">
                {forecast.length > 0 ? (
                  <StationForecastChart points={forecast} currentBikes={currentBikes} />
                ) : (
                  <p className="py-8 text-center text-sm text-gray-400">
                    {detailPending
                      ? '예상 대수를 불러오는 중입니다.'
                      : detailFailed
                        ? '예상 대수를 불러오지 못했습니다.'
                        : '아직 예상 대수를 제공하지 않는 대여소입니다.'}
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
