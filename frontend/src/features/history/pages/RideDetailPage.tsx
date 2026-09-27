import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { formatDate } from '@/shared/lib/format';
import { ElevationChart } from '@/shared/ui/ElevationChart';
import { GRADE_META, WALK_COLOR } from '@/shared/ui/grade';
import { RouteSketch } from '@/shared/ui/RouteSketch';
import { BIKE_STATIONS_QUERY_KEY, getBikeStations } from '@/features/map/api/stations';
import { getUsageDetail } from '@/features/history/api/rides';
import { UsagePathMap } from '@/features/history/components/UsagePathMap';
import {
  maxGradePct,
  pointLabel,
  toElevationBars,
  toSegments,
  toSketchPath,
  totalAscentM,
} from '@/features/history/lib/usageDisplay';

/** 떠 있는 헤더의 위 여백과 높이(px) — 지도 맞춤 여백 계산에도 쓴다 */
const HEADER_TOP_PX = 16;
const HEADER_HEIGHT_PX = 44;

/** 안드로이드 상태 표시줄 높이 — Capacitor가 앱 시작 때 넣어 두는 값이라 첫 렌더에 읽을 수 있다. 웹에서는 0 */
function readSafeAreaTop(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top');
  const px = Number.parseFloat(raw);
  return Number.isFinite(px) ? px : 0;
}

/**
 * 23 기록 상세 — 응답의 GPS 경로(pathInfo)에서 경로 지도·고도 그래프·구간 안내를 파생한다.
 * 경로를 저장하지 않은 기록(pathInfo null)은 요약만 보여준다.
 */
export function RideDetailPage() {
  const navigate = useNavigate();
  const { rideId = '' } = useParams();
  const { data: ride, isPending, error } = useQuery({
    queryKey: ['usageDetail', rideId],
    queryFn: () => getUsageDetail(rideId),
    enabled: rideId.length > 0,
  });
  const { data: stations } = useQuery({
    queryKey: BIKE_STATIONS_QUERY_KEY,
    queryFn: getBikeStations,
  });

  // GPS 경로에서 파생하는 표시값들 — 경로가 바뀔 때만 다시 계산한다
  const road = ride?.pathInfo?.road ?? null;
  const derived = useMemo(() => {
    if (road === null || road.length < 2 || ride === undefined) return null;
    return {
      sketch: toSketchPath(road),
      bars: toElevationBars(road),
      ascentM: totalAscentM([...road].sort((a, b) => a.seq - b.seq)),
      maxGrade: maxGradePct(road),
      segments: toSegments(road, {
        startingDate: ride.startingDate,
        totalDurationSec: ride.totalDuration,
        cycleRidingStartTime: ride.cycleRidingStartTime,
        cycleRidingEndTime: ride.cycleRidingEndTime,
      }),
    };
  }, [road, ride]);

  const durationMin = ride ? Math.max(1, Math.round(ride.totalDuration / 60)) : 0;
  const [safeTop] = useState(readSafeAreaTop);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-canvas">
      {/* 경로 지도 + 플로팅 헤더. 지도를 못 띄우면 추상 경로 그림으로 대신한다 */}
      <div className="relative shrink-0">
        {derived && road !== null ? (
          <UsagePathMap
            road={road}
            fallback={<RouteSketch path={derived.sketch} />}
            headerHeight={safeTop + HEADER_TOP_PX + HEADER_HEIGHT_PX}
          />
        ) : (
          <div className="aspect-100/64 w-full bg-surface-soft" />
        )}
        {/* 앱은 상태 표시줄 뒤까지 그리므로 안전 영역만큼 내린다 */}
        <div
          className="absolute right-5 left-5 flex items-center gap-3"
          style={{ top: safeTop + HEADER_TOP_PX }}
        >
          <button
            type="button"
            aria-label="뒤로 가기"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-md active:scale-[0.96]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-800" fill="none">
              <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {ride && (
            <div className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-surface px-4 shadow-md">
              <span className="truncate font-bold text-gray-900">
                {pointLabel(ride.startingPoint, stations)}
              </span>
              <span aria-hidden className="text-gray-800">➞</span>
              <span className="truncate font-bold text-gray-900">
                {pointLabel(ride.endPoint, stations)}
              </span>
            </div>
          )}
        </div>
      </div>

      {isPending && <p className="px-5 pt-4 text-sm text-gray-400">불러오는 중…</p>}
      {error && <p className="px-5 pt-4 text-sm text-status-low">에러: {error.message}</p>}

      {ride && (
        <div className="relative -mt-4 rounded-t-[30px] bg-canvas px-5 pt-1 pb-8">
          {/* 요약 */}
          <p className="tabular-nums mt-4 text-sm text-gray-500">
            {formatDate(ride.startingDate)} · {ride.cycleId}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-[22px] border border-line bg-surface p-4 shadow-[0_7px_22px_rgba(42,60,34,0.045)]">
            {[
              { label: '이동 시간', value: `${durationMin}분` },
              {
                label: '총 거리',
                value:
                  ride.totalDistance !== null
                    ? `${(ride.totalDistance / 1000).toFixed(1)}km`
                    : '–',
              },
              {
                label: '자전거 평균 속도',
                value:
                  ride.averageCycleRidingSpeed !== null
                    ? `${Math.round(ride.averageCycleRidingSpeed)}km/h`
                    : '–',
              },
            ].map((item) => (
              <div key={item.label} className="min-w-0 text-center">
                <p className="text-xs text-muted">{item.label}</p>
                <p className="tabular-nums mt-1 text-[17px] font-extrabold text-ink">{item.value}</p>
              </div>
            ))}
          </div>

          {derived ? (
            <>
              {/* 고도 그래프 */}
              <div className="mt-8 flex items-baseline justify-between">
                <h2 className="text-[19px] font-extrabold text-ink">고도 그래프</h2>
                <p className="tabular-nums text-sm text-gray-500">
                  누적 상승 {derived.ascentM}m · 최대 경사 {derived.maxGrade}%
                </p>
              </div>
              <div className="mt-4">
                <ElevationChart bars={derived.bars} />
              </div>

              {/* 구간 안내 */}
              <h2 className="mt-8 text-[19px] font-extrabold text-ink">구간 안내</h2>
              <ul className="mt-4 space-y-5">
                {derived.segments.map((segment, i) => {
                  const isWalk = segment.type === 'walk';
                  return (
                    <li key={i} className="flex gap-3.5">
                      <span
                        aria-hidden
                        className="mt-1 h-4 w-4 shrink-0 rounded-full"
                        style={{ backgroundColor: isWalk ? WALK_COLOR : GRADE_META.gentle.color }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-500">{isWalk ? '도보' : '자전거'}</p>
                        <p className="tabular-nums text-lg font-bold text-gray-900">
                          {segment.durationMin !== null && `${segment.durationMin}분 · `}
                          {segment.distanceM >= 1000
                            ? `${(segment.distanceM / 1000).toFixed(1)}km`
                            : `${segment.distanceM}m`}
                        </p>
                        {!isWalk && (
                          <p className="tabular-nums text-sm text-gray-400">
                            누적 상승 {segment.ascentM}m · 최대 경사 {segment.maxGradePct}%
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="mt-8 text-sm text-gray-400">
              이 기록에는 저장된 경로가 없어 요약만 보여드려요.
            </p>
          )}

          <p className="mt-10 text-center text-xs text-gray-400">
            타슈 공식 대여이력이 아닌, 잘타슈 내비게이션 이동 기록입니다.
          </p>
        </div>
      )}
    </div>
  );
}
