import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getAdminStation, getAdminStationTrend } from '@/features/admin/api/adminStation';
import { StationTrendChart } from '@/features/admin/components/StationTrendChart';
import { AdminDetailState } from '@/features/admin/ui/AdminDetailState';
import { AdminStatCard } from '@/features/admin/ui/AdminStatCard';

/**
 * 02 대여소 상세 — 대여소 이용 현황(01)의 목록 행이나 지도 원을 눌러 진입한다.
 * 백엔드 대여소 마스터의 현재 한글 명칭과 통계를 보여준다.
 */
export function AdminStationPage() {
  const { stationId = '' } = useParams();

  const detail = useQuery({
    queryKey: ['adminStation', stationId],
    queryFn: () => getAdminStation(stationId),
  });
  // 현재 상세 화면의 대여소만 조회하고 캐시도 대여소별로 분리한다.
  const trend = useQuery({
    queryKey: ['adminStationTrend', stationId],
    queryFn: () => getAdminStationTrend(stationId),
    enabled: stationId.length > 0,
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
          ← 대여소 이용 현황
        </Link>
        <div className="mt-2 flex items-baseline gap-3">
          <h2 className="text-xl font-semibold">{station.stationName}</h2>
          <span className="text-sm text-admin-muted tabular-nums">{stationId}</span>
          <span className="text-sm text-admin-muted">어제 대비는 24시간 전 기준</span>
        </div>
      </div>

      {/* 통계 4카드 — 전부 어제(24시간 전) 대비 증감을 함께 보여준다 */}
      <div className="grid grid-cols-4 gap-4">
        <AdminStatCard
          label="오늘 대여"
          value={`${station.todayRentalCnt}건`}
          delta={station.todayRentalCnt - station.yesterdayRentalCnt}
        />
        <AdminStatCard
          label="오늘 반납"
          value={`${station.todayReturnCnt}건`}
          delta={station.todayReturnCnt - station.yesterdayReturnCnt}
        />
        <AdminStatCard
          label="현재 자전거"
          value={`${station.currentBikeCnt}대`}
          delta={station.currentBikeCnt - station.yesterdayBikeCnt}
        />
        <AdminStatCard
          label="미해결 제보"
          value={`${station.currentReportCnt}건`}
          valueClass={station.currentReportCnt > 0 ? 'text-admin-danger-text' : ''}
          delta={station.currentReportCnt - station.yesterdayReportCnt}
        />
      </div>

      {/* 현재 대여소의 최근 7일 추이 */}
      <section className="rounded-lg border border-admin-line p-5">
        <h3 className="mb-4 text-base font-semibold">
          최근 7일 대여·반납
        </h3>
        {trend.isPending && <p className="text-sm text-admin-muted">불러오는 중…</p>}
        {trend.isError && <p className="text-sm text-admin-muted">추이를 불러오지 못했습니다.</p>}
        {trend.data && <StationTrendChart points={trend.data} />}
      </section>
    </div>
  );
}
