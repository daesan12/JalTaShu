import { readCssToken } from '@/shared/lib/cssToken';
import type { StationTrendPoint } from '@/features/admin/api/adminStation';

/**
 * 02 대여소 상세의 7일 대여/반납 묶음 막대그래프.
 * 관리자 전체에서 차트는 이것 하나뿐이라 라이브러리 없이 SVG로 그린다(인수인계 규칙).
 */
const CHART_WIDTH = 720;
const CHART_HEIGHT = 220;
const PLOT_TOP = 16;
const PLOT_BOTTOM = 36; // 날짜 라벨 자리
const BAR_WIDTH = 24;
const BAR_GAP = 4; // 대여-반납 막대 사이
const LABEL_COLOR = 'var(--color-admin-muted)';

export function StationTrendChart({ points }: { points: StationTrendPoint[] }) {
  const rentColor = readCssToken('--color-admin-heat-rent');
  const returnColor = readCssToken('--color-admin-heat-return');

  const max = Math.max(1, ...points.flatMap((p) => [p.rentalCnt, p.returnCnt]));
  const plotHeight = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
  const slotWidth = CHART_WIDTH / Math.max(1, points.length);
  const baselineY = CHART_HEIGHT - PLOT_BOTTOM;
  const barHeight = (value: number) => (value / max) * plotHeight;

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-admin-muted">
        <span>
          <Dot color={rentColor} /> 대여
        </span>
        <span>
          <Dot color={returnColor} /> 반납
        </span>
        <span className="ml-auto tabular-nums">최대 {max}건</span>
      </div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="최근 7일 대여·반납 추이"
      >
        {/* 기준선(최대·중간·0) */}
        {[0, 0.5, 1].map((ratio) => (
          <line
            key={ratio}
            x1={0}
            x2={CHART_WIDTH}
            y1={baselineY - plotHeight * ratio}
            y2={baselineY - plotHeight * ratio}
            stroke="var(--color-admin-line)"
            strokeWidth={1}
          />
        ))}
        {points.map((point, i) => {
          const centerX = slotWidth * i + slotWidth / 2;
          const rentH = barHeight(point.rentalCnt);
          const returnH = barHeight(point.returnCnt);
          return (
            <g key={point.date}>
              <rect
                x={centerX - BAR_WIDTH - BAR_GAP / 2}
                y={baselineY - rentH}
                width={BAR_WIDTH}
                height={rentH}
                rx={3}
                fill={rentColor}
              >
                <title>{`${point.date} 대여 ${point.rentalCnt}건`}</title>
              </rect>
              <rect
                x={centerX + BAR_GAP / 2}
                y={baselineY - returnH}
                width={BAR_WIDTH}
                height={returnH}
                rx={3}
                fill={returnColor}
              >
                <title>{`${point.date} 반납 ${point.returnCnt}건`}</title>
              </rect>
              <text
                x={centerX}
                y={CHART_HEIGHT - 12}
                textAnchor="middle"
                fontSize={12}
                fill={LABEL_COLOR}
              >
                {point.date.slice(5).replace('-', '/')}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-[-1px]"
      style={{ backgroundColor: color }}
    />
  );
}
