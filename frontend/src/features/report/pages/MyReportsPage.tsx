import { useQuery } from '@tanstack/react-query';
import { formatTimeAgo } from '@/shared/lib/format';
import { TopHeader } from '@/shared/ui/TopHeader';
import {
  CLAIM_CATEGORY_TO_TAG,
  getMyClaims,
  toReportTypeLabel,
} from '@/features/report/api/reports';
import { TagBadge } from '@/features/report/components/TagBadge';

/** 접수한 민원 목록 — 서버 응답에 없는 처리 상태는 임의로 표시하지 않는다. */
export function MyReportsPage() {
  const { data: claims, isPending, error } = useQuery({
    queryKey: ['myClaims'],
    queryFn: getMyClaims,
  });

  return (
    <div className="flex h-full flex-col bg-canvas">
      <TopHeader title="내 민원 내역" />

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="pt-4">
          <p className="text-xs font-semibold tracking-[0.1em] text-primary">MY REQUESTS</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[21px] font-extrabold text-ink">접수한 내용을 확인하세요</h2>
              <p className="mt-1 text-sm text-muted">문의 유형과 작성 내용을 모아봤어요.</p>
            </div>
            {claims && <span className="shrink-0 rounded-full bg-primary-light px-3 py-1.5 text-sm font-bold text-primary">{claims.length}건</span>}
          </div>
        </div>

        {isPending && <div className="mt-5 h-28 animate-pulse rounded-[22px] bg-surface-soft motion-reduce:animate-none" aria-label="민원 내역 불러오는 중" />}
        {error && <div className="mt-5 rounded-2xl border border-status-low/20 bg-red-50 p-4 text-sm text-status-low">민원 내역을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>}

        {claims && claims.length === 0 && (
          <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-[24px] border border-dashed border-line bg-surface text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-lg font-bold text-primary">✓</span>
            <p className="mt-3 font-bold text-ink">접수한 민원이 없어요</p>
            <p className="mt-1 text-sm text-muted">필요한 경우 민원 화면에서 바로 접수할 수 있어요.</p>
          </div>
        )}

        {claims && claims.length > 0 && (
          <ul className="mt-5 space-y-3">
            {claims.map((claim) => (
              <li key={claim.claimId} className="rounded-[22px] border border-line bg-surface p-4 shadow-[0_7px_22px_rgba(42,60,34,0.045)]">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 font-bold text-ink">
                    {toReportTypeLabel(claim.claimType)}
                    {claim.claimCategory && <TagBadge tag={CLAIM_CATEGORY_TO_TAG[claim.claimCategory]} />}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">{formatTimeAgo(claim.createdAt)}</span>
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{claim.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
