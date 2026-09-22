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
    <div className="flex h-full flex-col bg-canvas">
      <TopHeader title="제보 리스트" />

      <div className="flex-1 overflow-y-auto px-5 pt-2 pb-5">
        {isPending && <p className="rounded-2xl bg-surface p-4 text-sm text-muted">제보 내역을 불러오는 중이에요…</p>}
        {error && <p className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-status-low">제보 내역을 불러오지 못했습니다. {error.message}</p>}

        {reports && (
          <>
            <div className="rounded-[26px] bg-[linear-gradient(140deg,#345f0d,#5b941f)] p-5 text-white shadow-[0_14px_30px_rgba(52,95,13,0.18)]">
              <p className="text-xs font-semibold tracking-[0.12em] text-white/65">BIKE REPORTS</p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <span className="tabular-nums text-[25px] font-extrabold">{code}</span>
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">전체 {reports.length}건</span>
              </div>
              <p className="mt-3 text-sm text-white/70">최근 이용자가 남긴 자전거 상태 정보를 확인하세요.</p>
            </div>

            {reports.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">아직 제보가 없어요.</p>
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

            <p className="mt-5 text-center text-xs text-muted">
              이용 내역에서 자전거를 선택하면 이 리스트로 연결돼요.
            </p>
          </>
        )}
      </div>

      {/* 자전거 코드를 미리 채운 채 고장신고(17-1)로 — 재스캔 방지 */}
      <div className="border-t border-line bg-surface px-5 pt-3 pb-4">
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
