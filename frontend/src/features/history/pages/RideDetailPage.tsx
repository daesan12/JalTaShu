import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { formatDate } from '@/shared/lib/format';
import { getRideDetail } from '@/features/history/api/rides';
import { ElevationChart } from '@/features/history/components/ElevationChart';
import { RouteSketch } from '@/features/history/components/RouteSketch';
import { GRADE_META, WALK_COLOR } from '@/features/history/lib/grade';

/** 23 기록 상세 */
export function RideDetailPage() {
  const navigate = useNavigate();
  const { rideId = '' } = useParams();
  const { data: ride, isPending, error } = useQuery({
    queryKey: ['ride', rideId],
    queryFn: () => getRideDetail(rideId),
    enabled: rideId.length > 0,
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* 경로 그림 + 플로팅 헤더 */}
      <div className="relative shrink-0">
        {ride ? (
          <RouteSketch path={ride.path} />
        ) : (
          <div className="aspect-100/64 w-full bg-background" />
        )}
        <div className="absolute top-4 right-5 left-5 flex items-center gap-3">
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
              <span className="truncate font-bold text-gray-900">{ride.from}</span>
              <span aria-hidden className="text-gray-800">➞</span>
              <span className="truncate font-bold text-gray-900">{ride.to}</span>
            </div>
          )}
        </div>
      </div>

      {isPending && <p className="px-5 pt-4 text-sm text-gray-400">불러오는 중…</p>}
      {error && <p className="px-5 pt-4 text-sm text-status-low">에러: {error.message}</p>}

      {ride && (
        <div className="px-5 pb-8">
          {/* 요약 */}
          <p className="tabular-nums mt-4 text-sm text-gray-500">
            {formatDate(ride.date)} · {ride.bikeCode}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              { label: '이동 시간', value: `${ride.durationMin}분` },
              { label: '총 거리', value: `${ride.distanceKm}km` },
              { label: '자전거 평균 속도', value: `${ride.avgSpeedKmh}km/h` },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-sm text-gray-500">{item.label}</p>
                <p className="tabular-nums mt-0.5 text-xl font-bold text-gray-900">{item.value}</p>
              </div>
            ))}
          </div>

          {/* 고도 그래프 */}
          <div className="mt-8 flex items-baseline justify-between">
            <h2 className="text-[19px] font-bold text-gray-900">고도 그래프</h2>
            <p className="tabular-nums text-sm text-gray-500">
              누적 상승 {ride.totalAscentM}m · 최대 경사 {ride.maxGradePct}%
            </p>
          </div>
          <div className="mt-4">
            <ElevationChart bars={ride.elevationBars} />
          </div>

          {/* 구간 안내 */}
          <h2 className="mt-8 text-[19px] font-bold text-gray-900">구간 안내</h2>
          <ul className="mt-4 space-y-5">
            {ride.segments.map((segment, i) => {
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
                      {segment.durationMin}분 ·{' '}
                      {segment.distanceM >= 1000
                        ? `${(segment.distanceM / 1000).toFixed(1)}km`
                        : `${segment.distanceM}m`}
                    </p>
                    <p className="tabular-nums text-sm text-gray-400">
                      {isWalk
                        ? segment.description
                        : `누적 상승 ${segment.ascentM}m · 최대 경사 ${segment.maxGradePct}%`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-10 text-center text-xs text-gray-400">
            타슈 공식 대여이력이 아닌, 잘타슈 내비게이션 이동 기록입니다.
          </p>
        </div>
      )}
    </div>
  );
}
