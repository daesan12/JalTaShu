import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { TopHeader } from '@/shared/ui/TopHeader';
import { getCycleClaims } from '@/features/rental/api/bikes';
import { BikeReportCard } from '@/features/rental/components/BikeReportCard';

/** 20 제보 리스트 — 자전거 한 대의 전체 제보 (백엔드 GET /cycle/list?cycleId= 실구현) */
export function BikeReportsPage() {
  const { code = '' } = useParams();
  const { data: reports, isPending, error } = useQuery({
    queryKey: ['bikeClaims', code],
    queryFn: () => getCycleClaims(code),
    enabled: code.length > 0,
  });

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="제보 리스트" />

      <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4">
        {isPending && <p className="text-sm text-gray-400">불러오는 중…</p>}
        {error && <p className="text-sm text-status-low">에러: {error.message}</p>}

        {reports && (
          <>
            <div className="flex items-center justify-between rounded-2xl bg-background px-5 py-4">
              <span className="tabular-nums text-lg font-bold text-gray-900">{code}</span>
              <span className="text-sm text-gray-500">전체 제보 {reports.length}건</span>
            </div>

            {reports.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">아직 제보가 없어요.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {reports.map((report, i) => (
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
