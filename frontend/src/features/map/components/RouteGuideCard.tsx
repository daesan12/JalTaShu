import { formatDistance } from '@/shared/lib/format';
import { WALK_COLOR } from '@/shared/ui/grade';
import type { RouteProgress } from '@/features/map/lib/routeProgress';
import { legInstruction } from '@/features/map/lib/routeProgress';

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

/** 구간 종류 아이콘 — 도보는 사람, 자전거는 바퀴 */
function LegIcon({ walking }: { walking: boolean }) {
  return walking ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <circle cx="13" cy="4.5" r="1.8" fill="currentColor" stroke="none" />
      <path d="M10 21l2.5-5.5L10 12l1-4 3 2 2.5 1M11 8l-3 2-1 3m5.5 2.5L16 21" {...stroke} />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <circle cx="6" cy="17" r="3.4" {...stroke} />
      <circle cx="18" cy="17" r="3.4" {...stroke} />
      <path d="M9 17l3.5-7H16M8 10h5M15 6h2.5l1.5 4" {...stroke} />
    </svg>
  );
}

interface RouteGuideCardProps {
  progress: RouteProgress;
  /** 마지막 구간인지 — 도보 안내 문구가 "대여소까지"인지 "목적지까지"인지 가른다 */
  isLastLeg: boolean;
  /** 총 구간 수 — 진행 표시(2/3)에 쓴다 */
  legCount: number;
  /** 위치를 못 받고 있으면 남은 거리가 실제와 다를 수 있다고 알린다 */
  locationUnknown: boolean;
}

/**
 * 12 경로 안내 — 지금 해야 할 일 카드.
 *
 * 구간(도보 → 자전거 → 도보) 단위로 "무엇을 하는 중인지"와 그 구간이 얼마나 남았는지를 보여준다.
 * 회전 단위 안내("몇 m 앞 우회전")는 서버가 `steps[].behave`로 주기 시작했고, 이 카드 위에
 * 얹는 것은 다음 이슈다.
 */
export function RouteGuideCard({
  progress,
  isLastLeg,
  legCount,
  locationUnknown,
}: RouteGuideCardProps) {
  const walking = progress.leg?.mode === 'WALK';
  return (
    <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 p-4">
      <div className="pointer-events-auto rounded-2xl bg-surface p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{
              color: walking ? WALK_COLOR : 'var(--color-primary)',
              backgroundColor: walking ? 'rgb(37 99 235 / 0.12)' : 'var(--color-primary-light)',
            }}
          >
            <LegIcon walking={walking} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-gray-900">
              {legInstruction(progress.leg, isLastLeg)}
            </p>
            <p className="mt-0.5 text-sm tabular-nums text-gray-500">
              이 구간 {formatDistance(progress.legRemainingM)} 남음
              {legCount > 0 ? ` · ${progress.legIndex + 1}/${legCount}단계` : ''}
            </p>
          </div>
        </div>
        {locationUnknown ? (
          <p className="mt-3 border-t border-gray-100 pt-2.5 text-xs text-gray-500">
            현재 위치를 받지 못해 출발 기준으로 보여 줍니다.
          </p>
        ) : null}
      </div>
    </div>
  );
}
