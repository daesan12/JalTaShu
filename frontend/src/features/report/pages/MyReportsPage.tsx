import { useQuery } from '@tanstack/react-query';
import { formatTimeAgo } from '@/shared/lib/format';
import { TopHeader } from '@/shared/ui/TopHeader';
import { getMyReports, REPORT_TYPE_LABEL, type MyReport } from '@/features/report/api/reports';
import { TagBadge } from '@/features/report/components/TagBadge';

const STATUS_CLASS: Record<MyReport['status'], string> = {
  접수됨: 'bg-gray-100 text-gray-600',
  처리중: 'bg-amber-50 text-status-mid',
  완료: 'bg-primary-light text-primary',
};

/** 17-4 내 민원 내역 */
export function MyReportsPage() {
  const { data: reports, isPending, error } = useQuery({
    queryKey: ['myReports'],
    queryFn: getMyReports,
  });

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="내 민원 내역" />

      <div className="flex-1 overflow-y-auto px-5">
        {isPending && <p className="pt-4 text-sm text-gray-400">불러오는 중…</p>}
        {error && <p className="pt-4 text-sm text-status-low">에러: {error.message}</p>}

        {reports && reports.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center pb-24 text-center">
            <p className="text-[15px] text-gray-400">접수한 민원이 없어요.</p>
          </div>
        )}

        {reports && reports.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {reports.map((report) => (
              <li key={report.id} className="py-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold text-gray-900">
                    {REPORT_TYPE_LABEL[report.type]}
                    {report.bikeCode && (
                      <span className="tabular-nums text-sm font-normal text-gray-500">
                        {report.bikeCode}
                      </span>
                    )}
                    {report.tag && <TagBadge tag={report.tag} detail={report.tagDetail} />}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[report.status]}`}
                  >
                    {report.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{report.content}</p>
                <p className="mt-1 text-xs text-gray-400">{formatTimeAgo(report.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
