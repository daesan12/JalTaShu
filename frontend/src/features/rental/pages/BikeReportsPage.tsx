import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { TopHeader } from '@/shared/ui/TopHeader';
import { getBikeStatus } from '@/features/rental/api/bikes';
import { BikeReportCard } from '@/features/rental/components/BikeReportCard';

/** 20 제보 리스트 — 자전거 한 대의 전체 제보 */
export function BikeReportsPage() {
  const { code = '' } = useParams();
  const { data: bike, isPending, error } = useQuery({
    queryKey: ['bike', code],
    queryFn: () => getBikeStatus(code),
    enabled: code.length > 0,
  });

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="제보 리스트" />

      <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4">
        {isPending && <p className="text-sm text-gray-400">불러오는 중…</p>}
        {error && <p className="text-sm text-status-low">에러: {error.message}</p>}

        {bike && (
          <>
            <div className="flex items-center justify-between rounded-2xl bg-background px-5 py-4">
              <span className="tabular-nums text-lg font-bold text-gray-900">{bike.code}</span>
              <span className="text-sm text-gray-500">전체 제보 {bike.reports.length}건</span>
            </div>

            {bike.reports.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">아직 제보가 없어요.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {bike.reports.map((report, i) => (
                  <BikeReportCard key={i} report={report} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
