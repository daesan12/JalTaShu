import { formatTimeAgo } from '@/shared/lib/format';
import { TagBadge } from '@/features/report/components/TagBadge';
import type { BikeReport } from '@/features/rental/api/bikes';

/** 18·20 공용 제보 카드 */
export function BikeReportCard({ report }: { report: BikeReport }) {
  return (
    <li className="rounded-2xl border border-gray-200 bg-surface p-4">
      <TagBadge tag={report.tag} detail={report.tagDetail} />
      <p className="mt-2 text-[15px] text-gray-800">{report.content}</p>
      <p className="mt-1.5 text-sm text-gray-400">
        {report.nickname} · {formatTimeAgo(report.createdAt)}
      </p>
    </li>
  );
}
