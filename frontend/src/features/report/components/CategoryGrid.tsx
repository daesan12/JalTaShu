import type { ReportType } from '@/features/report/api/reports';

/** 17-0~17-3 공용 2×2 민원 카테고리 카드 그리드 */
const CATEGORIES: { type: ReportType; label: string; sub?: string }[] = [
  // 괄호를 제목에 붙이면 좁은 화면(360dp)에서 "등)"만 다음 줄로 꺾여 부가설명 줄로 분리
  { type: 'broken', label: '고장신고', sub: '반납오류 등' },
  { type: 'abandoned', label: '방치신고' },
  { type: 'inquiry', label: '기타 문의' },
];

interface CategoryGridProps {
  selected: ReportType | null;
  onSelect: (type: ReportType) => void;
  onMyReports: () => void;
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
            className={`min-h-24 rounded-2xl border px-4 py-4 text-left text-[15px] transition-[background-color,border-color,color] duration-75 active:scale-[0.98] ${
              isSelected
                ? 'border-2 border-primary bg-primary-light font-semibold text-primary'
                : 'border-gray-200 bg-surface font-medium text-gray-800 active:bg-gray-50'
            }`}
          >
            {label}
            {sub && (
              <span
                className={`mt-0.5 block text-xs font-normal ${isSelected ? 'text-primary/80' : 'text-gray-500'}`}
              >
                {sub}
              </span>
            )}
          </button>
        );
      })}
      {/* 나의민원 조회는 폼이 아니라 17-4 페이지로 이동 (디자인상 회색 배경) */}
      <button
        type="button"
        onClick={onMyReports}
        className="min-h-24 rounded-2xl border border-gray-200 bg-background px-4 py-4 text-left text-[15px] font-medium text-gray-800 transition-[background-color] duration-75 active:scale-[0.98] active:bg-gray-100"
      >
        나의 민원 조회
      </button>
    </div>
  );
}
