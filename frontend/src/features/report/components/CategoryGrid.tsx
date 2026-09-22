import type { ReportType } from '@/features/report/api/reports';

const CATEGORIES: { type: ReportType; label: string; sub: string }[] = [
  { type: 'broken', label: '고장신고', sub: '운행·반납 문제' },
  { type: 'abandoned', label: '방치신고', sub: '통행을 막는 자전거' },
  { type: 'inquiry', label: '기타 문의', sub: '서비스 이용 문의' },
];

interface CategoryGridProps {
  selected: ReportType | null;
  onSelect: (type: ReportType) => void;
  onMyReports: () => void;
}

function CategoryIcon({ type }: { type: ReportType | 'history' }) {
  if (type === 'broken') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="m14.5 6.5 3-3 3 3-3 3m-1.5 1L8.3 17.7a2 2 0 0 1-2.8 0l-.2-.2a2 2 0 0 1 0-2.8L12.5 7.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (type === 'abandoned') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <circle cx="7" cy="17" r="3" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17" cy="17" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="m7 17 4-7 3 7m-5-4h7l-2-5h-3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (type === 'inquiry') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M12 18h.01M9.4 9.3a2.8 2.8 0 1 1 4.5 2.2c-1.1.8-1.9 1.3-1.9 2.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M6 5h12M6 9h12M6 13h7M6 17h9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CategoryGrid({ selected, onSelect, onMyReports }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {CATEGORIES.map(({ type, label, sub }) => {
        const isSelected = selected === type;
        return (
          <button
            key={type}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(type)}
            className={`min-h-28 rounded-[22px] border p-4 text-left text-ink transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${
              isSelected
                ? 'border-primary/55 bg-primary-light shadow-[0_9px_24px_rgba(76,138,18,0.12)]'
                : 'border-line bg-surface shadow-[0_6px_18px_rgba(42,60,34,0.05)] hover:border-primary/25'
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${isSelected ? 'bg-primary text-white' : 'bg-surface-soft text-primary'}`}
            >
              <CategoryIcon type={type} />
            </span>
            <span className="mt-3 block text-[15px] font-bold">{label}</span>
            <span className="mt-0.5 block text-xs opacity-70">{sub}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onMyReports}
        className="min-h-28 rounded-[22px] border border-line bg-surface p-4 text-left text-ink shadow-[0_6px_18px_rgba(42,60,34,0.05)] transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_9px_24px_rgba(42,60,34,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 active:scale-[0.98] active:bg-surface-soft motion-reduce:transform-none motion-reduce:transition-none"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-soft text-primary">
          <CategoryIcon type="history" />
        </span>
        <span className="mt-3 block text-[15px] font-bold">나의 민원 조회</span>
        <span className="mt-0.5 block text-xs text-muted">접수한 내용 확인</span>
      </button>
    </div>
  );
}
