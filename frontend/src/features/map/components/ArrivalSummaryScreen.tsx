import type { RoutePath } from '@/shared/api/types';
import { formatDistance } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { ElevationChart } from '@/shared/ui/ElevationChart';
import { buildElevationProfile } from '@/features/map/lib/routeElevation';
import { formatMinutes } from '@/features/map/lib/routeMetrics';

interface ArrivalSummaryScreenProps {
  destinationTitle: string;
  /** 안내 시작부터 도착까지 실제 걸린 시간(초) */
  elapsedSec: number;
  totalDistanceM: number;
  bikeDistanceM: number;
  route: RoutePath;
  onClose: () => void;
}

/**
 * 12 안내 중 목적지 30m 이내로 도착하면 뜨는 전체 화면 요약.
 * "기록" 탭 저장(경호님 담당 features/history)은 이번 범위에서 뺐다 — 백엔드 저장 API가 없어서
 * 계산 결과를 어디에도 남기지 않고 화면에만 보여준다. 닫으면 목적지·경로가 초기화되고 지도로 나간다.
 */
export function ArrivalSummaryScreen({
  destinationTitle,
  elapsedSec,
  totalDistanceM,
  bikeDistanceM,
  route,
  onClose,
}: ArrivalSummaryScreenProps) {
  const profile = buildElevationProfile(route);

  return (
    <div className="pt-safe pb-safe absolute inset-0 z-50 flex flex-col bg-surface">
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
          {destinationTitle}까지 {formatMinutes(elapsedSec)} 만에 도착했어요
        </p>

        {profile.bars.length > 0 && (
          <div className="mt-8 rounded-2xl bg-gray-50 p-4">
            <ElevationChart bars={profile.bars} />
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">총 시간</p>
            <p className="tabular-nums mt-2 text-3xl font-bold text-gray-900">
              {formatMinutes(elapsedSec)}
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

      <div className="px-5">
        <Button full onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}
