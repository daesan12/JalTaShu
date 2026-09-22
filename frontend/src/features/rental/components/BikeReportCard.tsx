import { formatTimeAgo } from '@/shared/lib/format';
import { TagBadge } from '@/features/report/components/TagBadge';
import type { BikeReport } from '@/features/rental/api/bikes';

interface BikeReportCardProps {
  report: BikeReport;
  /** 넘기지 않으면 신고 버튼을 숨긴다 */
  onReport?: (report: BikeReport) => void;
  /** 이미 신고한 제보 */
  reported?: boolean;
  /** 오늘 신고 한도를 다 씀 */
  exhausted?: boolean;
}

/** 18·20 공용 제보 카드 — 다른 사람의 제보가 잘못됐으면 오른쪽 "신고"로 알린다 */
export function BikeReportCard({
  report,
  onReport,
  reported = false,
  exhausted = false,
}: BikeReportCardProps) {
  return (
    <li className="rounded-[20px] border border-line bg-surface p-4 shadow-[0_6px_18px_rgba(42,60,34,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <TagBadge tag={report.tag} detail={report.tagDetail} />
        {onReport && (
          <button
            type="button"
            disabled={reported || exhausted}
            onClick={() => onReport(report)}
            aria-label={reported ? '이미 신고한 제보입니다' : '이 제보 신고하기'}
            className="min-h-9 shrink-0 rounded-full border border-line bg-surface-soft px-3.5 text-sm font-medium text-muted transition-[background-color] duration-75 active:bg-primary-light disabled:opacity-40"
          >
            {reported ? '신고됨' : '신고'}
          </button>
        )}
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-ink">{report.content}</p>
      <p className="mt-2 text-xs text-muted">
        {report.nickname} · {formatTimeAgo(report.createdAt)}
      </p>
    </li>
  );
}
