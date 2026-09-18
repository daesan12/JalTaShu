import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { formatDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { TopHeader } from '@/shared/ui/TopHeader';
import { getBikeStatus } from '@/features/rental/api/bikes';
import { BikeDiagram } from '@/features/rental/components/BikeDiagram';
import { BikeReportCard } from '@/features/rental/components/BikeReportCard';
import { ClaimReportSheet } from '@/features/rental/components/ClaimReportSheet';
import { useClaimReport } from '@/features/rental/hooks/useClaimReport';

/** 18 화면에 노출할 최근 제보 수 (전체는 20 제보 리스트에서) */
const RECENT_REPORT_COUNT = 3;

/** 18 자전거 상태 — 스캔·수동 입력한 코드의 상태·제보. 제보 부위는 다이어그램에 붉게 표시 */
export function BikeStatusPage() {
  const navigate = useNavigate();
  const { code = '' } = useParams();
  const { data: bike, isPending, error } = useQuery({
    queryKey: ['bike', code],
    queryFn: () => getBikeStatus(code),
    enabled: code.length > 0,
  });
  const claimReport = useClaimReport();

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="자전거 상태" />

      <div className="flex-1 space-y-5 overflow-y-auto px-5 pt-2 pb-4">
        {isPending && <p className="text-sm text-gray-400">불러오는 중…</p>}
        {error && <p className="text-sm text-status-low">에러: {error.message}</p>}

        {bike && (
          <>
            {/* 상단 요약 카드 */}
            <section className="rounded-2xl bg-background p-5">
              <div className="flex items-center justify-between">
                <p className="tabular-nums text-2xl font-bold text-gray-900">{bike.code}</p>
                <span
                  className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${
                    bike.rideable ? 'bg-primary-light text-primary' : 'bg-red-50 text-status-low'
                  }`}
                >
                  {bike.rideable ? '정상' : '점검 필요'}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
                <span>최근 이용 {formatDate(bike.lastUsedAt)}</span>
                <span>{bike.lastStationName}</span>
              </div>
            </section>

            {/* 제보 부위 다이어그램 */}
            <BikeDiagram
              highlighted={bike.reports.map((r) => r.tag)}
              className="rounded-2xl border border-gray-100 px-6 py-3"
            />

            {/* 최근 제보 */}
            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-bold text-gray-900">
                  최근 제보 {bike.reports.length}건
                </h2>
                {bike.reports.length > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate(`/report/bikes/${bike.code}/reports`)}
                    className="min-h-11 px-1 text-sm font-medium text-blue-500"
                  >
                    전체보기
                  </button>
                )}
              </div>
              {bike.reports.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">아직 제보가 없어요.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {bike.reports.slice(0, RECENT_REPORT_COUNT).map((report) => (
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
            </section>
          </>
        )}
      </div>

      {bike && (
        <div className="space-y-2.5 px-5 pb-4">
          {/* 대여·반납은 타슈 앱에서 — Capacitor 래핑 시 AppLauncher 플러그인으로 교체 */}
          <Button full onClick={() => window.open('https://www.tashu.or.kr', '_blank')}>
            타슈에서 대여하기
          </Button>
          {/* 자전거 코드를 미리 채운 채 고장신고(17-1)로 — 재스캔 방지 */}
          <button
            type="button"
            onClick={() => navigate(`/report?type=broken&code=${bike.code}`)}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-status-low font-semibold text-status-low transition-[background-color] duration-75 active:bg-red-50"
          >
            문제 신고하기
          </button>
        </div>
      )}

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
