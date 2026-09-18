import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { formatDate, formatDistance, formatMinutes } from '@/shared/lib/format';
import { ELLIPSIS, getPageItems } from '@/shared/lib/pagination';
import { BIKE_STATIONS_QUERY_KEY, getBikeStations } from '@/features/map/api/stations';
import { getUsageList, getUsageStats } from '@/features/history/api/rides';
import { pointLabel } from '@/features/history/lib/usageDisplay';

const PAGE_SIZE = 5;

/** 이용 내역 행의 경로 아이콘 (파랑=도보, 초록=자전거 두 줄) */
function RouteIcon() {
  return (
    <span
      aria-hidden
      className="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl bg-background"
    >
      <span className="h-1 w-6 rounded-full bg-blue-500" />
      <span className="h-1 w-6 translate-x-[-3px] rounded-full bg-primary" />
    </span>
  );
}

/**
 * 22 이동 기록 — 나의 경로 탭.
 * 서버가 페이지네이션 없이 전체를 주므로(실측) 페이지는 프론트에서 나눈다.
 * 출발·도착 이름도 응답에 없어 좌표를 지도 대여소 목록과 대조해 복원한다.
 */
export function HistoryPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const stats = useQuery({ queryKey: ['usageStats'], queryFn: getUsageStats });
  const { data: rides, isPending, error } = useQuery({
    queryKey: ['usageList'],
    queryFn: getUsageList,
  });
  // 좌표 → 대여소 이름 대조용 (지도 탭과 캐시 공유)
  const { data: stations } = useQuery({
    queryKey: BIKE_STATIONS_QUERY_KEY,
    queryFn: getBikeStations,
  });

  const totalPages = Math.ceil((rides?.length ?? 0) / PAGE_SIZE);
  const pageItems = (rides ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-gray-100 px-5 pt-5 pb-4">
        <h1 className="text-[22px] font-bold text-gray-900">이동 기록</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col px-5 pb-6">
        {isPending && <p className="pt-4 text-sm text-gray-400">불러오는 중…</p>}
        {error && <p className="pt-4 text-sm text-status-low">에러: {error.message}</p>}

        {rides && (
          <>
            {/* 누적 통계 (GET /cycle/statics — 거리 m·시간 초) */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="row-span-2 flex flex-col items-center justify-center rounded-2xl bg-primary-light py-6">
                <p className="text-sm text-gray-500">누적 이용 횟수</p>
                <p className="tabular-nums mt-2 text-3xl font-bold text-primary">
                  {stats.data ? `${stats.data.totalUseCnt}회` : '–'}
                </p>
              </div>
              <div className="rounded-2xl bg-background px-4 py-4">
                <p className="text-sm text-gray-500">누적 이동 거리</p>
                <p className="tabular-nums mt-1 text-xl font-bold text-gray-900">
                  {stats.data ? formatDistance(stats.data.totalDistance) : '–'}
                </p>
              </div>
              <div className="rounded-2xl bg-background px-4 py-4">
                <p className="text-sm text-gray-500">자전거 이용 시간</p>
                <p className="tabular-nums mt-1 text-xl font-bold text-gray-900">
                  {stats.data ? formatMinutes(Math.round(stats.data.totalCycleRidingTime / 60)) : '–'}
                </p>
              </div>
            </div>

            {/* 이용 내역 */}
            <h2 className="mt-8 text-[19px] font-bold text-gray-900">이용 내역</h2>
            {rides.length === 0 && (
              <p className="pt-3 text-sm text-gray-400">아직 이용 기록이 없습니다.</p>
            )}
            <ul className="mt-2 divide-y divide-gray-100">
              {pageItems.map((ride) => (
                <li key={ride.usageId}>
                  <button
                    type="button"
                    onClick={() => navigate(`/history/${ride.usageId}`)}
                    className="flex min-h-18 w-full items-center gap-3.5 py-3 text-left active:bg-gray-50"
                  >
                    <RouteIcon />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-gray-900">
                        {pointLabel(ride.startingPoint, stations)} →{' '}
                        {pointLabel(ride.endPoint, stations)}
                      </span>
                      <span className="tabular-nums mt-0.5 block text-sm text-gray-500">
                        {formatDate(ride.startingDate)} ·{' '}
                        {Math.max(1, Math.round(ride.totalDuration / 60))}분 · {ride.cycleId}
                      </span>
                    </span>
                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-300" fill="none">
                      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>

            {/* 페이지네이션 — 내역이 적어도 항상 스크롤 영역 바닥에 */}
            {totalPages > 1 && (
              <nav aria-label="페이지" className="mt-auto flex items-center justify-center gap-2 pt-6">
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
                      className={`tabular-nums flex h-10 w-10 items-center justify-center rounded-full text-[15px] transition-[background-color,color] duration-75 ${
                        item === page
                          ? 'bg-primary font-bold text-white'
                          : 'font-medium text-gray-500 active:bg-gray-100'
                      }`}
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
    </div>
  );
}
