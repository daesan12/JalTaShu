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

/**
 * 관측 시각이 이보다 오래되면 **실시간이 끊긴 대여소**로 보고 언제 값인지 밝힌다.
 *
 * 수집기가 45초마다 전체 스냅샷을 갈아끼우므로 정상 대여소는 이 선을 넘지 않는다.
 * 넘는 건 최신 스냅샷에서 빠져 백엔드가 마지막 성공값으로 채워 준 대여소뿐이고,
 * 그런 대여소는 보통 몇 시간에서 며칠씩 밀려 있어 경계가 넉넉하다.
 * 백엔드가 둘을 구분해 주지 않아(둘 다 `time` 하나로 온다) 시각을 보고 판단한다.
 */
const STALE_AFTER_MS = 2 * 60 * 1000;

interface StationSheetProps {
  /** null이면 닫힌 상태 */
  station: BikeStation | null;
  snap: StationSnap;
  onSnapChange: (snap: StationSnap) => void;
  onClose: () => void;
  /** 지금 빌린 자전거가 있으면 버튼이 "반납하기"가 된다 */
  rented: boolean;
  /** "대여하기" — QR 스캔으로 보낸다(스캔이 대여인지 반납인지 스스로 가른다) */
  onRent: () => void;
  /** "반납하기" — 지금 이 대여소를 반납 대여소로 삼아 번호 입력 시트를 연다 */
  onReturn: () => void;
}

/**
 * 마커를 탭했을 때 07 위에 얹는 대여소 시트.
 * 요약만 보다가 위로 끌면 예상 대수 타임라인이 나온다(2-1).
 * 예상 대수는 목록이 아니라 **상세 API**에만 있어서, 확장했을 때만 그 대여소 하나를 부른다.
 */
export function StationSheet({
  station,
  snap,
  onSnapChange,
  onClose,
  rented,
  onRent,
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
    dataUpdatedAt: detailReceivedAt,
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

  /*
   * 평소에는 시각을 붙이지 않는다 — 대부분의 대여소는 방금 받은 값이라 알려 봤자 소음이고,
   * 지도의 갱신 배지가 이미 "언제 받아왔는지"를 말해 준다.
   * 실시간이 끊겨 옛 값이 그대로 오는 대여소에서만 "N분 전 데이터"로 밝힌다.
   *
   * 얼마나 뒤처졌는지는 "지금"이 아니라 **응답을 받은 시각**과 견준다. 렌더 도중 Date.now()를
   * 부르면 다시 그릴 때마다 판정이 흔들리고, 서버가 준 두 시각을 비교하는 편이 뜻에도 맞다.
   */
  const measuredAt = detail?.updatedAt ?? null;
  const staleAt =
    measuredAt !== null && detailReceivedAt - Date.parse(measuredAt) >= STALE_AFTER_MS
      ? measuredAt
      : null;

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
        <div className={showDetail ? 'flex flex-col gap-3 pb-4' : 'flex flex-col gap-1'}>
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
                {/* 실시간이 끊긴 대여소에서만 — 이 대수가 언제 값인지 밝힌다 */}
                {staleAt === null ? null : (
                  <span className="text-gray-400"> · {formatTimeAgo(staleAt)} 데이터</span>
                )}
              </p>
            </div>
            <StatusBadge status={toStationStatus(currentBikes)} className="shrink-0" />
          </div>

          {!showDetail ? (
            <button
              type="button"
              onClick={() => onSnapChange('half')}
              className="flex min-h-6 items-center justify-center gap-1 rounded-lg text-xs font-medium text-primary active:bg-primary-light motion-reduce:transition-none"
            >
              <span>위로 열어 향후 예상 대수 보기</span>
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 12 4-4 4 4" />
              </svg>
            </button>
          ) : null}

          {/*
            peek에서는 그리지 않는다 — 110px는 이름 줄만으로도 거의 차서 버튼이 반쯤 잘려 보인다.
            대신 **드래그가 시작되면 바로** 그려서, 끌어올리는 동안 이 내용이 그대로 따라 올라온다
          */}
          {showDetail ? (
            <section>
              {/*
                빌리기 전에 "반납하기"를 보여 주면 빌리지도 않은 사람에게 반납을 권하는 셈이다.
                반납은 번호 입력 시트로 보낸다 — 앱 데이터가 지워져 QR 반납이 막혔을 때
                돌아갈 길이 이것뿐이다(`rentalSession.ts`).
              */}
              <Button full variant="line" onClick={rented ? onReturn : onRent}>
                {rented ? '반납하기' : '대여하기'}
              </Button>

              <h2 className="mt-4 text-[15px] font-semibold text-gray-900">예상 자전거 수</h2>
              <p className="mt-1 text-xs text-gray-500">
                시간 다이얼을 움직여 앞으로 남아 있을 것으로 예상되는 대수를 확인하세요.
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
