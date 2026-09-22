import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { formatDate, formatDistance, formatMinutes } from '@/shared/lib/format';
import { ELLIPSIS, getPageItems } from '@/shared/lib/pagination';
import { BIKE_STATIONS_QUERY_KEY, getBikeStations } from '@/features/map/api/stations';
import { getUsageList, getUsageStats } from '@/features/history/api/rides';
import { pointLabel } from '@/features/history/lib/usageDisplay';

const PAGE_SIZE = 5;

function RouteIcon() {
  return (
    <span
      aria-hidden
      className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary"
    >
      <span className="absolute top-3.5 h-2 w-2 rounded-full border-2 border-current bg-surface" />
      <span className="h-5 w-0.5 rounded-full bg-current opacity-35" />
      <span className="absolute bottom-3.5 h-2 w-2 rounded-full bg-current" />
    </span>
  );
}

export function HistoryPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const stats = useQuery({ queryKey: ['usageStats'], queryFn: getUsageStats });
  const {
    data: rides,
    isPending,
    error,
  } = useQuery({ queryKey: ['usageList'], queryFn: getUsageList });
  const { data: stations } = useQuery({
    queryKey: BIKE_STATIONS_QUERY_KEY,
    queryFn: getBikeStations,
  });

  const totalPages = Math.ceil((rides?.length ?? 0) / PAGE_SIZE);
  const pageItems = (rides ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(circle_at_88%_3%,rgba(124,173,69,0.12),transparent_30%),var(--color-canvas)]">
      <header className="px-5 pt-5 pb-3">
        <p className="text-xs font-semibold tracking-[0.12em] text-primary">MY RIDES</p>
        <h1 className="mt-1 text-[24px] font-extrabold text-ink">이동 기록</h1>
        <p className="mt-1.5 text-sm text-muted">잘타슈와 함께 이동한 기록을 모아봤어요.</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {isPending && (
          <div
            className="mt-4 h-48 animate-pulse rounded-[28px] bg-surface-soft motion-reduce:animate-none"
            aria-label="이동 기록 불러오는 중"
          />
        )}
        {error && (
          <div className="mt-4 rounded-2xl border border-status-low/20 bg-red-50 p-4 text-sm text-status-low">
            이동 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </div>
        )}

        {rides && (
          <>
            <section className="relative mt-3 overflow-hidden rounded-[28px] border border-line/80 bg-surface p-5 shadow-[0_16px_36px_rgba(42,60,34,0.1)]">
              <span
                aria-hidden
                className="absolute -top-16 -right-14 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(124,173,69,0.26),rgba(124,173,69,0)_70%)]"
              />
              <svg
                aria-hidden
                viewBox="0 0 120 72"
                className="absolute top-3 right-2 h-20 w-32 text-primary/20"
              >
                <path
                  d="M8 62c14-4 10-26 30-24s11-24 31-22 20 20 43 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="1 8"
                />
                <circle cx="8" cy="62" r="4" fill="currentColor" />
                <circle cx="112" cy="21" r="5" fill="currentColor" />
              </svg>
              <div className="relative">
                <p className="text-sm font-semibold text-primary">지금까지 함께한 이동</p>
                <div className="mt-1 flex items-end gap-1.5 text-ink">
                  <strong className="tabular-nums text-[42px] leading-none font-extrabold">
                    {stats.data ? stats.data.totalUseCnt : '–'}
                  </strong>
                  <span className="pb-1 text-base font-bold text-muted">회</span>
                </div>
              </div>
              <div className="relative mt-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-line/80 bg-surface-soft px-3.5 py-3.5 text-ink">
                  <p className="text-xs font-medium opacity-70">누적 이동 거리</p>
                  <p className="tabular-nums mt-1 text-lg font-extrabold">
                    {stats.data ? formatDistance(stats.data.totalDistance) : '–'}
                  </p>
                </div>
                <div className="rounded-2xl border border-line/80 bg-primary-light/55 px-3.5 py-3.5 text-ink">
                  <p className="text-xs font-medium opacity-70">자전거 이용 시간</p>
                  <p className="tabular-nums mt-1 text-lg font-extrabold">
                    {stats.data
                      ? formatMinutes(Math.round(stats.data.totalCycleRidingTime / 60))
                      : '–'}
                  </p>
                </div>
              </div>
            </section>

            <div className="mt-7 flex items-center justify-between">
              <h2 className="text-[19px] font-extrabold text-ink">이용 내역</h2>
              <span className="text-sm text-muted">총 {rides.length}건</span>
            </div>

            {rides.length === 0 ? (
              <div className="mt-3 flex min-h-48 flex-col items-center justify-center rounded-[24px] border border-dashed border-line bg-surface text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-xl text-primary">
                  ↗
                </span>
                <p className="mt-3 font-semibold text-ink">아직 이동 기록이 없어요</p>
                <p className="mt-1 text-sm text-muted">길 안내를 시작하면 여기에 기록됩니다.</p>
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {pageItems.map((ride) => (
                  <li key={ride.usageId}>
                    <button
                      type="button"
                      onClick={() => navigate(`/history/${ride.usageId}`)}
                      className="group relative flex min-h-22 w-full items-center gap-3.5 overflow-hidden rounded-[22px] border border-line bg-[linear-gradient(135deg,#ffffff,#fbfdf9)] p-4 text-left shadow-[0_7px_22px_rgba(42,60,34,0.05)] transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_11px_28px_rgba(42,60,34,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 active:scale-[0.99] active:bg-surface-soft motion-reduce:transform-none motion-reduce:transition-none"
                    >
                      <RouteIcon />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-ink">
                          {pointLabel(ride.startingPoint, stations)} →{' '}
                          {pointLabel(ride.endPoint, stations)}
                        </span>
                        <span className="tabular-nums mt-1 block text-sm text-muted">
                          {formatDate(ride.startingDate)} ·{' '}
                          {Math.max(1, Math.round(ride.totalDuration / 60))}분
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-400">
                          자전거 {ride.cycleId}
                        </span>
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5 shrink-0 text-gray-300 transition-transform duration-150 group-hover:translate-x-0.5 group-active:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="m9 5 7 7-7 7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {totalPages > 1 && (
              <nav aria-label="페이지" className="mt-6 flex items-center justify-center gap-2">
                {getPageItems(page, totalPages).map((item, i) =>
                  item === ELLIPSIS ? (
                    <span key={`e${i}`} className="px-1 text-gray-300">
                      ···
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      aria-current={item === page ? 'page' : undefined}
                      onClick={() => setPage(item)}
                      className={`tabular-nums flex h-10 w-10 items-center justify-center rounded-full text-[15px] transition-colors ${item === page ? 'bg-primary font-bold text-white shadow-sm' : 'font-medium text-muted active:bg-surface-soft'}`}
                    >
                      {item}
                    </button>
                  ),
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
