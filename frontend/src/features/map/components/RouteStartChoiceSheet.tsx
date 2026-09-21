import { formatDistance } from '@/shared/lib/format';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';

interface RouteStartChoiceSheetProps {
  open: boolean;
  startName: string;
  distanceM: number;
  recommendedCourse: boolean;
  pending: 'to-start' | 'from-current' | null;
  onGuideToStart: () => void;
  onStartFromCurrent: () => void;
  onClose: () => void;
}

/** 선택한 출발지와 실제 GPS 위치가 다를 때 안내 시작 방식을 명시적으로 고르는 시트. */
export function RouteStartChoiceSheet({
  open,
  startName,
  distanceM,
  recommendedCourse,
  pending,
  onGuideToStart,
  onStartFromCurrent,
  onClose,
}: RouteStartChoiceSheetProps) {
  const busy = pending !== null;

  return (
    <BottomSheet open={open} snapPoint="half" onClose={onClose} backdrop>
      <div className="flex flex-col gap-4 pb-5">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-primary">출발 위치 확인</p>
          <h2 className="mt-1 text-xl font-bold text-ink">선택한 출발지까지 먼저 이동할까요?</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            현재 위치가 <span className="font-semibold text-ink">{startName}</span>에서{' '}
            <span className="font-semibold tabular-nums text-ink">{formatDistance(distanceM)}</span>{' '}
            떨어져 있어요.
          </p>
        </div>

        <div className="rounded-2xl border border-primary/15 bg-primary-light/55 px-4 py-3 text-sm leading-6 text-gray-700">
          {recommendedCourse
            ? '코스 시작점까지 먼저 안내한 뒤 전체 추천 코스 안내를 이어서 시작합니다.'
            : '출발지까지 먼저 안내받거나, 선택한 출발지를 취소하고 현재 위치에서 바로 출발할 수 있어요.'}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <Button full disabled={busy} onClick={onGuideToStart}>
            {pending === 'to-start'
              ? '출발지까지 경로 찾는 중…'
              : recommendedCourse
                ? '코스 시작점까지 안내'
                : '출발지까지 안내'}
          </Button>
          {recommendedCourse ? null : (
            <Button full variant="line" disabled={busy} onClick={onStartFromCurrent}>
              {pending === 'from-current' ? '현재 위치에서 경로 찾는 중…' : '현재 위치에서 출발'}
            </Button>
          )}
          <Button full variant="text" disabled={busy} onClick={onClose}>
            취소
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
