import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CategoryGrid } from '@/features/report/components/CategoryGrid';
import { ReportForm } from '@/features/report/components/ReportForm';
import type { ReportType } from '@/features/report/api/reports';

const REPORT_TYPES: ReportType[] = ['broken', 'abandoned', 'inquiry'];

/** 자전거 확인과 공식 민원을 한 화면에서 이어 주는 사용자 지원 허브 */
export function ReportPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const formRef = useRef<HTMLDivElement>(null);

  const typeParam = searchParams.get('type');
  const type = REPORT_TYPES.includes(typeParam as ReportType) ? (typeParam as ReportType) : null;
  const code = searchParams.get('code') ?? '';

  useEffect(() => {
    if (type) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [type]);

  const selectType = (next: ReportType) => setSearchParams({ type: next }, { replace: true });
  const goScan = () => {
    if (type) navigate(`/report/scan?next=${encodeURIComponent(`/report?type=${type}`)}`);
  };

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(circle_at_92%_4%,rgba(124,173,69,0.12),transparent_30%),var(--color-canvas)]">
      <header className="relative overflow-hidden px-5 pt-5 pb-3">
        <p className="text-xs font-semibold tracking-[0.12em] text-primary">HELP CENTER</p>
        <h1 className="mt-1 text-[24px] leading-tight font-extrabold text-ink">
          무엇을 도와드릴까요?
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          자전거 상태를 확인하거나 필요한 민원을 접수하세요.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <button
          type="button"
          onClick={() => navigate('/report/scan')}
          className="group relative mt-3 flex w-full items-center gap-4 overflow-hidden rounded-[26px] border border-line/80 bg-[radial-gradient(circle_at_94%_16%,rgba(124,173,69,0.24),transparent_34%),linear-gradient(135deg,#ffffff,#fbfdf8)] p-5 text-left text-ink shadow-[0_14px_32px_rgba(42,60,34,0.11)] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_18px_38px_rgba(42,60,34,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none"
        >
          <span
            aria-hidden
            className="absolute -right-8 -bottom-14 h-36 w-36 rounded-full border-[24px] border-primary/6"
          />
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-primary-light text-lg font-extrabold text-primary shadow-sm transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none">
            QR
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold">자전거 상태 확인</span>
            <span className="mt-1 block text-sm leading-snug text-muted">
              QR을 스캔해 상태와 이용자 제보를 확인해요
            </span>
          </span>
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0 text-primary/55"
            fill="none"
            aria-hidden
          >
            <path
              d="m9 5 7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="mt-6 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-primary">민원 접수</p>
            <h2 className="mt-1 text-[19px] font-extrabold text-ink">어떤 도움이 필요한가요?</h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/mypage/support')}
            className="min-h-10 shrink-0 rounded-full bg-surface-soft px-3.5 text-sm font-semibold text-primary active:bg-primary-light"
          >
            고객센터
          </button>
        </div>

        <div className="mt-4">
          <CategoryGrid
            selected={type}
            onSelect={selectType}
            onMyReports={() => navigate('/report/my')}
          />
        </div>

        {!type && (
          <div className="mt-5 flex gap-2.5 rounded-2xl border border-line bg-surface/80 p-4 text-sm leading-relaxed text-muted">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-soft text-xs font-bold text-primary">
              i
            </span>
            <p>
              고장·방치·기타 민원은 타슈 공식 민원으로 전달되며, 자전거 상태 제보는 잘타슈에서 함께
              확인할 수 있어요.
            </p>
          </div>
        )}

        {type && (
          <div ref={formRef} className="scroll-mt-4">
            <ReportForm key={type} type={type} initialCode={code} onScan={goScan} />
          </div>
        )}
      </div>
    </div>
  );
}
