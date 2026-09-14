import { GRADE_META, GRADE_ORDER } from '@/features/history/lib/grade';
import type { ElevationBar } from '@/features/history/api/rides';

/**
 * 고도 그래프 (23) — 자전거 구간을 경사도별 색 막대로 표현.
 * 색만으로 구분하지 않도록 범례(라벨)와 막대별 title을 함께 제공.
 */
export function ElevationChart({ bars }: { bars: ElevationBar[] }) {
  return (
    <div>
      <div
        role="img"
        aria-label={`고도 그래프: 구간 ${bars.length}개, 경사도별 색 구분`}
        className="flex h-28 items-end gap-1 border-b border-gray-200 pb-px"
      >
        {bars.map((bar, i) => (
          <div
            key={i}
            title={`구간 ${i + 1}: ${GRADE_META[bar.grade].label}`}
            className="min-w-0 flex-1 rounded-t"
            style={{
              height: `${Math.round(bar.value * 100)}%`,
              backgroundColor: GRADE_META[bar.grade].color,
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-gray-400">
        <span>출발</span>
        <span>도착</span>
      </div>

      {/* 범례 */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {GRADE_ORDER.map((grade) => (
          <li key={grade} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: GRADE_META[grade].color }}
            />
            {GRADE_META[grade].label}
          </li>
        ))}
      </ul>
    </div>
  );
}
