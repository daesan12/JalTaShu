import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { formatTimeAgo } from '@/shared/lib/format';
import { getAdminStation, getAdminStationTrend } from '@/features/admin/api/adminStation';
import { StationTrendChart } from '@/features/admin/components/StationTrendChart';
import { AdminBadge } from '@/features/admin/ui/AdminBadge';
import { AdminDetailState } from '@/features/admin/ui/AdminDetailState';
import { AdminStatCard } from '@/features/admin/ui/AdminStatCard';
import { AdminTable } from '@/features/admin/ui/AdminTable';

/** 02 대여소 상세 — 통계 4카드, 7일 추이, 배치 자전거 목록. 히트맵(01)의 원을 눌러 진입한다 */
export function AdminStationPage() {
  const { stationId = '' } = useParams();

  const detail = useQuery({
    queryKey: ['adminStation', stationId],
    queryFn: () => getAdminStation(stationId),
  });
  const trend = useQuery({
    queryKey: ['adminStationTrend', stationId],
    queryFn: () => getAdminStationTrend(stationId),
  });

  if (detail.isPending || detail.isError) {
    return (
      <AdminDetailState
        isError={detail.isError}
        errorText="대여소 정보를 불러오지 못했습니다."
        onRetry={() => void detail.refetch()}
      />
    );
  }

  const station = detail.data;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin" className="text-sm text-admin-muted hover:text-admin-text">
          ← 히트맵
        </Link>
        <div className="mt-2 flex items-baseline gap-3">
          <h2 className="text-xl font-semibold">{station.name}</h2>
          <span className="text-sm text-admin-muted">
            {station.stationId} · {station.address}
          </span>
        </div>
      </div>

      {/* 통계 4카드 */}
      <div className="grid grid-cols-4 gap-4">
        <AdminStatCard
          label="오늘 대여"
          value={`${station.todayRentCnt}건`}
          delta={station.todayRentCnt - station.yesterdayRentCnt}
        />
        <AdminStatCard
          label="오늘 반납"
          value={`${station.todayReturnCnt}건`}
          delta={station.todayReturnCnt - station.yesterdayReturnCnt}
        />
        <AdminStatCard
          label="배치 자전거"
          value={`${station.cycleCnt}대`}
          sub={`거치대 ${station.rackCnt}개`}
        />
        <AdminStatCard
          label="거치율"
          value={`${Math.round((station.cycleCnt / Math.max(1, station.rackCnt)) * 100)}%`}
          sub="배치 자전거 ÷ 거치대"
        />
      </div>

      {/* 7일 추이 */}
      <section className="rounded-lg border border-admin-line p-5">
        <h3 className="mb-4 text-base font-semibold">최근 7일 대여·반납</h3>
        {trend.isPending && <p className="text-sm text-admin-muted">불러오는 중…</p>}
        {trend.isError && <p className="text-sm text-admin-muted">추이를 불러오지 못했습니다.</p>}
        {trend.data && <StationTrendChart points={trend.data} />}
      </section>

      {/* 배치 자전거 목록 */}
      <section className="rounded-lg border border-admin-line p-5">
        <h3 className="mb-4 text-base font-semibold">
          배치 자전거 <span className="tabular-nums text-admin-muted">{station.cycles.length}</span>
        </h3>
        {station.cycles.length === 0 ? (
          <p className="text-sm text-admin-muted">현재 배치된 자전거가 없습니다.</p>
        ) : (
          <AdminTable>
            <thead>
              <tr>
                <th className="w-40">자전거 ID</th>
                <th className="w-28">상태</th>
                <th>최근 이용</th>
              </tr>
            </thead>
            <tbody>
              {station.cycles.map((cycle) => (
                <tr key={cycle.cycleId}>
                  <td className="tabular-nums">{cycle.cycleId}</td>
                  <td>
                    <AdminBadge state={cycle.statement} />
                  </td>
                  <td className="text-admin-muted">{formatTimeAgo(cycle.lastUsedAt)}</td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </section>
    </div>
  );
}
