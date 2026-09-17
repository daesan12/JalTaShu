import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getAdminStation, getAdminStationTrend } from '@/features/admin/api/adminStation';
import { StationTrendChart } from '@/features/admin/components/StationTrendChart';
import { AdminDetailState } from '@/features/admin/ui/AdminDetailState';
import { AdminStatCard } from '@/features/admin/ui/AdminStatCard';

/**
 * 02 대여소 상세 — 히트맵(01)의 원을 눌러 진입한다.
 * 백엔드 응답에 이름·주소·거치대·배치 자전거 목록이 없어(전달 목록) 통계 카드 중심으로 구성한다.
 */
export function AdminStationPage() {
  const { stationId = '' } = useParams();

  const detail = useQuery({
    queryKey: ['adminStation', stationId],
    queryFn: () => getAdminStation(stationId),
  });
  // ⚠ 서버 추이는 대여소 구분 없는 전체 합계다 (대여소별은 백엔드 전달 목록)
  const trend = useQuery({
    queryKey: ['adminStationTrend'],
    queryFn: getAdminStationTrend,
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
          <h2 className="text-xl font-semibold tabular-nums">대여소 {stationId}</h2>
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

      {/* 7일 추이 — 서버가 전체 합계만 줘서 이 대여소만의 추이가 아니다 */}
      <section className="rounded-lg border border-admin-line p-5">
        <h3 className="mb-4 text-base font-semibold">
          최근 7일 대여·반납 <span className="text-sm font-normal text-admin-muted">(전체 대여소)</span>
        </h3>
        {trend.isPending && <p className="text-sm text-admin-muted">불러오는 중…</p>}
        {trend.isError && <p className="text-sm text-admin-muted">추이를 불러오지 못했습니다.</p>}
        {trend.data && <StationTrendChart points={trend.data} />}
      </section>
    </div>
  );
}
