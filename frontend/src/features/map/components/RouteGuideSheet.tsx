import { formatDistance } from '@/shared/lib/format';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { formatMinutes } from '@/features/map/lib/routeMetrics';
import type { RouteProgress } from '@/features/map/lib/routeProgress';

interface RouteGuideSheetProps {
  open: boolean;
  progress: RouteProgress;
  /** 남은 시간(초) — 남은 거리 비율로 총 소요 시간을 줄여 잡는다 */
  remainingSec: number;
  onEnd: () => void;
}

/**
 * 12 경로 안내 — 하단 요약과 안내 종료.
 * 끌어서 닫히지 않는다(`dismissible={false}`). 종료는 버튼·뒤로가기로만.
 *
 * 도착 "시각" 대신 "남은 시간"을 보여준다 — 안내 중에는 몇 분 남았는지가 더 쓸모 있고,
 * 시각을 쓰면 렌더할 때마다 현재 시각을 읽어야 해서 결과가 불안정해진다.
 */
export function RouteGuideSheet({ open, progress, remainingSec, onEnd }: RouteGuideSheetProps) {
  return (
    <BottomSheet open={open} snapPoint="peek" onClose={onEnd} backdrop={false} dismissible={false}>
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="min-w-0">
          <p className="text-xl font-bold tabular-nums text-gray-900">
            {formatDistance(progress.remainingM)} 남음
          </p>
          <p className="mt-0.5 truncate text-xs tabular-nums text-gray-500">
            도착까지 약 {formatMinutes(remainingSec)}
          </p>
        </div>
        <Button variant="line" onClick={onEnd} className="shrink-0">
          안내 종료
        </Button>
      </div>
    </BottomSheet>
  );
}
