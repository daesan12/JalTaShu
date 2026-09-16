import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { formatDate, formatDistance, formatMinutes } from '@/shared/lib/format';
import { getRides } from '@/features/history/api/rides';
import { ELLIPSIS, getPageItems } from '@/shared/lib/pagination';

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

/** 22 이동 기록 — 나의 경로 탭 */
export function HistoryPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isPending, isFetching, error } = useQuery({
    queryKey: ['rides', page],
    queryFn: () => getRides(page),
    // 페이지 전환 시 이전 목록을 유지한 채 교체 (전체 로딩 화면 방지)
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-gray-100 px-5 pt-5 pb-4">
        <h1 className="text-[22px] font-bold text-gray-900">이동 기록</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col px-5 pb-6">
        {isPending && <p className="pt-4 text-sm text-gray-400">불러오는 중…</p>}
        {error && <p className="pt-4 text-sm text-status-low">에러: {error.message}</p>}

        {data && (
          <>
            {/* 누적 통계 */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="row-span-2 flex flex-col items-center justify-center rounded-2xl bg-primary-light py-6">
                <p className="text-sm text-gray-500">누적 이용 횟수</p>
                <p className="tabular-nums mt-2 text-3xl font-bold text-primary">
                  {data.stats.totalRides}회
                </p>
              </div>
              <div className="rounded-2xl bg-background px-4 py-4">
                <p className="text-sm text-gray-500">누적 이동 거리</p>
                <p className="tabular-nums mt-1 text-xl font-bold text-gray-900">
                  {formatDistance(data.stats.totalDistanceKm * 1000)}
                </p>
              </div>
              <div className="rounded-2xl bg-background px-4 py-4">
                <p className="text-sm text-gray-500">이동 시간</p>
                <p className="tabular-nums mt-1 text-xl font-bold text-gray-900">
                  {formatMinutes(data.stats.totalDurationMin)}
                </p>
              </div>
            </div>

            {/* 이용 내역 — 페이지 전환 중엔 살짝 흐리게 */}
            <h2 className="mt-8 text-[19px] font-bold text-gray-900">이용 내역</h2>
            <ul
              className={`mt-2 divide-y divide-gray-100 transition-[opacity] duration-150 ${
                isFetching ? 'opacity-50' : ''
              }`}
            >
              {data.rides.map((ride) => (
                <li key={ride.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/history/${ride.id}`)}
                    className="flex min-h-18 w-full items-center gap-3.5 py-3 text-left active:bg-gray-50"
                  >
                    <RouteIcon />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-gray-900">
                        {ride.from} → {ride.to}
                      </span>
                      <span className="tabular-nums mt-0.5 block text-sm text-gray-500">
                        {formatDate(ride.date)} · {ride.durationMin}분 · {ride.bikeCode}
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
            {data.totalPages > 1 && (
              <nav aria-label="페이지" className="mt-auto flex items-center justify-center gap-2 pt-6">
                {getPageItems(page, data.totalPages).map((item, i) =>
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
