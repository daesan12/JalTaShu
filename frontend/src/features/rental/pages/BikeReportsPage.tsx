import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/shared/ui/Button';
import { TopHeader } from '@/shared/ui/TopHeader';
import { getCycleClaims } from '@/features/rental/api/bikes';
import { BikeReportCard } from '@/features/rental/components/BikeReportCard';
import { ClaimReportSheet } from '@/features/rental/components/ClaimReportSheet';
import { useClaimReport } from '@/features/rental/hooks/useClaimReport';

/** 20 제보 리스트 — 자전거 한 대의 전체 제보 (백엔드 GET /cycle/list?cycleId= 실구현) */
export function BikeReportsPage() {
  const navigate = useNavigate();
  const { code = '' } = useParams();
  const { data: reports, isPending, error } = useQuery({
    queryKey: ['bikeClaims', code],
    queryFn: () => getCycleClaims(code),
    enabled: code.length > 0,
  });
  const claimReport = useClaimReport();

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
                {reports.map((report) => (
                  <BikeReportCard
                    key={report.claimId}
                    report={report}
                    onReport={claimReport.open}
                    reported={claimReport.isReported(report.claimId)}
                    exhausted={claimReport.exhausted}
                  />
                ))}
              </ul>
            )}

            <p className="mt-4 text-center text-xs text-gray-400">
              이용 내역에서 자전거를 선택하면 이 리스트로 연결돼요.
            </p>
          </>
        )}
      </div>

      {/* 자전거 코드를 미리 채운 채 고장신고(17-1)로 — 재스캔 방지 */}
      <div className="px-5 pb-4">
        <Button full onClick={() => navigate(`/report?type=broken&code=${code}`)}>
          문제 신고하기
        </Button>
      </div>

      <ClaimReportSheet
        target={claimReport.target}
        bikeCode={code}
        usedCount={claimReport.usedCount}
        onClose={claimReport.close}
        onReported={claimReport.markReported}
      />
    </div>
  );
}
