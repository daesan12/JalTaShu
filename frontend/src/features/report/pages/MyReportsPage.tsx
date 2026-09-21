import { useQuery } from '@tanstack/react-query';
import { formatTimeAgo } from '@/shared/lib/format';
import { TopHeader } from '@/shared/ui/TopHeader';
import {
  CLAIM_CATEGORY_TO_TAG,
  getMyClaims,
  toReportTypeLabel,
} from '@/features/report/api/reports';
import { TagBadge } from '@/features/report/components/TagBadge';

/**
 * 17-4 내 민원 내역.
 *
 * 처리 상태 배지는 없다 — 백엔드 `ClaimListResponse`에 상태가 오지 않는다(요청해 둔 상태).
 * 자전거 코드도 응답에 없어 유형과 부위만 보여준다.
 */
export function MyReportsPage() {
  const { data: claims, isPending, error } = useQuery({
    queryKey: ['myClaims'],
    queryFn: getMyClaims,
  });

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="내 민원 내역" />

      <div className="flex-1 overflow-y-auto px-5">
        {isPending && <p className="pt-4 text-sm text-gray-400">불러오는 중…</p>}
        {error && <p className="pt-4 text-sm text-status-low">에러: {error.message}</p>}

        {claims && claims.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center pb-24 text-center">
            <p className="text-[15px] text-gray-400">접수한 민원이 없어요.</p>
          </div>
        )}

        {claims && claims.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {claims.map((claim) => (
              <li key={claim.claimId} className="py-4">
                <span className="flex items-center gap-2 font-semibold text-gray-900">
                  {toReportTypeLabel(claim.claimType)}
                  {claim.claimCategory && (
                    <TagBadge tag={CLAIM_CATEGORY_TO_TAG[claim.claimCategory]} />
                  )}
                </span>
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{claim.content}</p>
                <p className="mt-1 text-xs text-gray-400">{formatTimeAgo(claim.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
