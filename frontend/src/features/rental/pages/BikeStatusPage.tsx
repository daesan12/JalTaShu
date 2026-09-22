import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { formatDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { TopHeader } from '@/shared/ui/TopHeader';
import { REPORT_TAGS, type ReportTag } from '@/features/report/api/reports';
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
    <div className="flex h-full flex-col bg-canvas">
      <TopHeader title="자전거 상태" />

      <div className="flex-1 space-y-5 overflow-y-auto px-5 pt-2 pb-5">
        {isPending && <p className="rounded-2xl bg-surface p-4 text-sm text-muted">자전거 정보를 불러오는 중이에요…</p>}
        {error && <p className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-status-low">자전거 정보를 불러오지 못했습니다. {error.message}</p>}

        {bike && (
          <>
            {/* 상단 요약 카드 */}
            <section className="overflow-hidden rounded-[28px] bg-[linear-gradient(140deg,#345f0d,#5b941f)] p-5 text-white shadow-[0_16px_34px_rgba(52,95,13,0.2)]">
              <p className="text-xs font-semibold tracking-[0.12em] text-white/65">BIKE STATUS</p>
              <div className="flex items-center justify-between">
                <p className="tabular-nums mt-1 text-[28px] font-extrabold">{bike.code}</p>
                <span
                  className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                    bike.rideable ? 'bg-white/95 text-primary' : 'bg-red-50 text-status-low'
                  }`}
                >
                  {bike.rideable ? '정상' : '점검 필요'}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/20 pt-4 text-sm">
                <div><span className="block text-xs text-white/60">최근 이용</span><span className="mt-1 block font-semibold text-white/90">{bike.lastUsedAt ? formatDate(bike.lastUsedAt) : '이용 이력 없음'}</span></div>
                <div><span className="block text-xs text-white/60">최근 대여소</span><span className="mt-1 block truncate font-semibold text-white/90">{bike.lastStationName ?? '대여소 정보 없음'}</span></div>
              </div>
            </section>

            {/* 제보 부위 다이어그램 */}
            <section className="rounded-[24px] border border-line bg-surface p-5 shadow-[0_7px_22px_rgba(42,60,34,0.045)]">
              <div><p className="text-xs font-semibold text-primary">한눈에 확인</p><h2 className="mt-1 text-[18px] font-extrabold text-ink">제보된 자전거 부위</h2></div>
              <BikeDiagram
                // 방치·기타 민원은 부위가 없어 배지 문구가 태그와 다르다 — 다이어그램에는 부위만 넘긴다
                highlighted={bike.reports.map((r) => r.tag).filter((tag): tag is ReportTag => (REPORT_TAGS as readonly string[]).includes(tag))}
                className="mt-3 rounded-2xl bg-surface-soft px-5 py-3"
              />
              <p className="mt-3 text-xs leading-relaxed text-muted">빨간색으로 표시된 부위는 최근 이용자가 문제를 제보한 곳이에요.</p>
            </section>

            {/* 최근 제보 */}
            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-extrabold text-ink">
                  최근 제보 {bike.reports.length}건
                </h2>
                {bike.reports.length > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate(`/report/bikes/${bike.code}/reports`)}
                    className="min-h-11 rounded-full px-3 text-sm font-semibold text-primary active:bg-primary-light"
                  >
                    전체보기
                  </button>
                )}
              </div>
              {bike.reports.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">아직 제보가 없어요.</p>
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
        <div className="space-y-2.5 border-t border-line bg-surface px-5 pt-3 pb-4">
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
