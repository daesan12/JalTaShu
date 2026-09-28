import type { RouteCandidate } from '@/shared/api/types';
import { formatDistance } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { RouteSketch } from '@/shared/ui/RouteSketch';
import { toSketchPath } from '@/features/history/lib/usageDisplay';
import { RouteResultMap } from '@/features/map/components/RouteResultMap';
import { formatSecondsAsMinutes } from '@/features/map/lib/routeMetrics';
import { toUsagePath } from '@/features/map/lib/usagePath';

interface ArrivalSummaryScreenProps {
  destinationTitle: string;
  /** 안내 시작부터 도착까지 실제 걸린 시간(초) */
  elapsedSec: number;
  totalDistanceM: number;
  bikeDistanceM: number;
  route: RouteCandidate;
  onClose: () => void;
}

/**
 * 12 안내 중 "도착 완료"를 누르면 뜨는 전체 화면 요약.
 *
 * 화면 전체를 덮어야 해서 `fixed`다 — `absolute`로 두면 탭바를 뺀 `main` 높이에만 갇혀서
 * 그 아래 안내 시트(`fixed bottom-0`)가 삐져나온다. 폭은 다른 전체 화면 오버레이와 같게 맞춘다.
 *
 * 저장은 `useRouteGuide`가 이 화면을 띄우면서 함께 보낸다(POST /cycle/usage).
 * 닫으면 목적지·경로가 초기화되고 지도로 나간다.
 */
export function ArrivalSummaryScreen({
  destinationTitle,
  elapsedSec,
  totalDistanceM,
  bikeDistanceM,
  route,
  onClose,
}: ArrivalSummaryScreenProps) {
  // 지도를 못 띄울 때만 쓰는 대비책 — 23 기록 상세와 같은 추상 경로 그림
  const sketch = toSketchPath(toUsagePath(route));

  return (
    <div className="pt-safe pb-safe fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[430px] -translate-x-1/2 flex-col bg-surface">
      <div className="flex-1 overflow-y-auto px-5 py-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-light">
          <svg
            viewBox="0 0 24 24"
            className="h-10 w-10 text-primary"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m5 13 5 5L20 7"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mt-6 text-center text-2xl font-bold text-gray-900">도착했어요!</h1>
        <p className="mt-2 text-center text-sm text-gray-500">
          {destinationTitle}까지 {formatSecondsAsMinutes(elapsedSec)} 만에 도착했어요
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl">
          <RouteResultMap
            route={route}
            fallback={sketch.length > 0 ? <RouteSketch path={sketch} /> : null}
          />
        </div>

        <div className="mt-4 flex gap-3">
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">총 시간</p>
            <p className="tabular-nums mt-2 text-3xl font-bold text-gray-900">
              {formatSecondsAsMinutes(elapsedSec)}
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">총 거리</p>
              <p className="tabular-nums mt-1 text-xl font-bold text-gray-900">
                {formatDistance(totalDistanceM)}
              </p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">자전거 거리</p>
              <p className="tabular-nums mt-1 text-xl font-bold text-gray-900">
                {formatDistance(bikeDistanceM)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5">
        <Button full onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}
