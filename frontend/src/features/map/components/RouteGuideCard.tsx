import { formatDistance } from '@/shared/lib/format';
import { WALK_COLOR } from '@/shared/ui/grade';
import type { NextCue } from '@/features/map/lib/routeCues';
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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <circle cx="13" cy="4.5" r="1.8" fill="currentColor" stroke="none" />
      <path d="M10 21l2.5-5.5L10 12l1-4 3 2 2.5 1M11 8l-3 2-1 3m5.5 2.5L16 21" {...stroke} />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <circle cx="6" cy="17" r="3.4" {...stroke} />
      <circle cx="18" cy="17" r="3.4" {...stroke} />
      <path d="M9 17l3.5-7H16M8 10h5M15 6h2.5l1.5 4" {...stroke} />
    </svg>
  );
}

/** 회전 방향 아이콘 — 서버가 준 type·modifier로 고른다 */
function TurnIcon({ type, modifier }: { type: string; modifier: string | null }) {
  const direction = modifier ?? '';
  if (type === 'arrive') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
        <path d="M6 21V4h11l-2 3.5L17 11H6" {...stroke} />
      </svg>
    );
  }
  if (type === 'roundabout' || type === 'rotary') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
        <circle cx="10" cy="13" r="4" {...stroke} />
        <path d="M10 21v-4M14 13h5m0 0-3-3m3 3-3 3" {...stroke} />
      </svg>
    );
  }
  if (direction === 'uturn') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
        <path d="M8 21V10a4 4 0 1 1 8 0v7m0 0-3-3m3 3 3-3" {...stroke} />
      </svg>
    );
  }
  if (direction.includes('left')) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
        <path d="M17 21v-9a4 4 0 0 0-4-4H6m0 0 4-4M6 8l4 4" {...stroke} />
      </svg>
    );
  }
  if (direction.includes('right')) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
        <path d="M7 21v-9a4 4 0 0 1 4-4h7m0 0-4-4m4 4-4 4" {...stroke} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <path d="M12 21V5m0 0-4 4m4-4 4 4" {...stroke} />
    </svg>
  );
}

function VoiceIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M4 9v6h3.5L13 19V5L7.5 9H4z" {...stroke} />
      {on ? (
        <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8 8 0 0 1 0 12" {...stroke} />
      ) : (
        <path d="M17 10l4 4m0-4-4 4" {...stroke} />
      )}
    </svg>
  );
}

interface RouteGuideCardProps {
  progress: RouteProgress;
  /** 다음 회전 안내. 회전이 없거나 다 지났으면 null — 그때는 구간 안내만 보여준다 */
  nextCue: NextCue | null;
  /** 마지막 구간인지 — 도보 안내 문구가 "대여소까지"인지 "목적지까지"인지 가른다 */
  isLastLeg: boolean;
  /** 총 구간 수 — 진행 표시(2/3)에 쓴다 */
  legCount: number;
  /** 위치를 못 받고 있으면 남은 거리가 실제와 다를 수 있다고 알린다 */
  locationUnknown: boolean;
  /** 경로를 벗어나 다시 찾는 중 */
  rerouting: boolean;
  voiceOn: boolean;
  voiceSupported: boolean;
  onToggleVoice: () => void;
}

/**
 * 12 경로 안내 — 지금 해야 할 일 카드.
 *
 * 위 줄은 **다음 회전**(서버가 준 한국어 문장 + 남은 거리), 아래 줄은 **지금 구간**
 * (걷는 중인지 타는 중인지 · 이 구간 남은 거리). 회전만 보면 무엇을 타고 있는지 알 수 없어서 둘 다 둔다.
 */
export function RouteGuideCard({
  progress,
  nextCue,
  isLastLeg,
  legCount,
  locationUnknown,
  rerouting,
  voiceOn,
  voiceSupported,
  onToggleVoice,
}: RouteGuideCardProps) {
  const walking = progress.leg?.mode === 'WALK';
  const legColor = walking ? WALK_COLOR : 'var(--color-primary)';
  const legText = legInstruction(progress.leg, isLastLeg);

  return (
    <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 p-4">
      <div className="pointer-events-auto rounded-2xl bg-surface p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{
              color: legColor,
              backgroundColor: walking ? 'rgb(37 99 235 / 0.12)' : 'var(--color-primary-light)',
            }}
          >
            {nextCue === null ? (
              <LegIcon walking={walking} />
            ) : (
              <TurnIcon type={nextCue.cue.maneuver.type} modifier={nextCue.cue.maneuver.modifier} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-gray-900">
              {nextCue === null ? legText : nextCue.cue.maneuver.instruction}
            </p>
            {nextCue === null ? null : (
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-gray-600">
                {formatDistance(nextCue.remainingM)} 앞
              </p>
            )}
          </div>
          {voiceSupported ? (
            <button
              type="button"
              aria-label={voiceOn ? '음성 안내 끄기' : '음성 안내 켜기'}
              aria-pressed={voiceOn}
              onClick={onToggleVoice}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[background-color,color] duration-75 active:scale-95 ${
                voiceOn ? 'bg-primary-light text-primary' : 'bg-gray-100 text-gray-400'
              }`}
            >
              <VoiceIcon on={voiceOn} />
            </button>
          ) : null}
        </div>

        <p className="mt-3 flex items-center gap-1.5 border-t border-gray-100 pt-2.5 text-sm tabular-nums text-gray-500">
          <span aria-hidden="true" style={{ color: legColor }}>
            <LegIcon walking={walking} />
          </span>
          <span className="truncate">
            {legText} · {formatDistance(progress.legRemainingM)} 남음
            {legCount > 0 ? ` · ${progress.legIndex + 1}/${legCount}단계` : ''}
          </span>
        </p>

        {rerouting ? (
          <p className="mt-2 text-xs text-primary">경로를 벗어나 다시 찾는 중입니다…</p>
        ) : null}
        {locationUnknown ? (
          <p className="mt-2 text-xs text-gray-500">현재 위치를 받지 못해 출발 기준으로 보여 줍니다.</p>
        ) : null}
      </div>
    </div>
  );
}
