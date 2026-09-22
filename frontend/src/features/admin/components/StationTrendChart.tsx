import { useState } from 'react';
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
const PLOT_LEFT = 56; // y축 눈금 값 자리
const BAR_WIDTH = 24;
const BAR_GAP = 4; // 대여-반납 막대 사이
const LABEL_COLOR = 'var(--color-admin-muted)';

/** 눈금 라벨이 읽히는 수로 떨어지게 올림한다 (25,307 → 30,000). */
const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = NICE_STEPS.find((candidate) => scaled <= candidate) ?? 10;
  return step * magnitude;
}

export function StationTrendChart({ points }: { points: StationTrendPoint[] }) {
  const rentColor = readCssToken('--color-admin-heat-rent');
  const returnColor = readCssToken('--color-admin-heat-return');
  // 어느 날짜 칸에 커서가 올라가 있는지. 막대가 아니라 칸 전체가 대상이라 얇은 막대도 짚기 쉽다
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const peak = Math.max(1, ...points.flatMap((p) => [p.rentalCnt, p.returnCnt]));
  const axisMax = niceCeil(peak);
  const plotHeight = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
  const plotWidth = CHART_WIDTH - PLOT_LEFT;
  const slotWidth = plotWidth / Math.max(1, points.length);
  const baselineY = CHART_HEIGHT - PLOT_BOTTOM;
  const barHeight = (value: number) => (value / axisMax) * plotHeight;
  const active = activeIndex === null ? null : (points[activeIndex] ?? null);

  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-4 text-xs text-admin-muted">
        <span>
          <Dot color={rentColor} /> 대여
        </span>
        <span>
          <Dot color={returnColor} /> 반납
        </span>
        <span className="ml-auto">막대에 커서를 올리면 건수가 보입니다</span>
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="최근 7일 대여·반납 추이"
      >
        {/* 눈금선과 값 — 값이 없으면 막대 높이를 숫자로 읽을 수 없다 */}
        {[0, 0.5, 1].map((ratio) => {
          const y = baselineY - plotHeight * ratio;
          return (
            <g key={ratio}>
              <line
                x1={PLOT_LEFT}
                x2={CHART_WIDTH}
                y1={y}
                y2={y}
                stroke="var(--color-admin-line)"
                strokeWidth={1}
              />
              <text
                x={PLOT_LEFT - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill={LABEL_COLOR}
                className="tabular-nums"
              >
                {(axisMax * ratio).toLocaleString()}
              </text>
            </g>
          );
        })}

        {points.map((point, i) => {
          const centerX = PLOT_LEFT + slotWidth * i + slotWidth / 2;
          const rentH = barHeight(point.rentalCnt);
          const returnH = barHeight(point.returnCnt);
          return (
            <g key={point.date}>
              {/* 커서가 올라간 칸을 옅게 칠한다 — 툴팁만으로는 어느 칸인지 놓치기 쉽다 */}
              {activeIndex === i && (
                <rect
                  x={centerX - slotWidth / 2}
                  y={PLOT_TOP}
                  width={slotWidth}
                  height={plotHeight}
                  fill="var(--color-admin-panel)"
                />
              )}
              <rect
                x={centerX - BAR_WIDTH - BAR_GAP / 2}
                y={baselineY - rentH}
                width={BAR_WIDTH}
                height={rentH}
                rx={3}
                fill={rentColor}
              />
              <rect
                x={centerX + BAR_GAP / 2}
                y={baselineY - returnH}
                width={BAR_WIDTH}
                height={returnH}
                rx={3}
                fill={returnColor}
              />
              <text
                x={centerX}
                y={CHART_HEIGHT - 12}
                textAnchor="middle"
                fontSize={12}
                fill={LABEL_COLOR}
                className="tabular-nums"
              >
                {point.date.slice(5).replace('-', '/')}
              </text>
              {/* 칸 전체를 덮는 투명 판 — 막대 사이 빈 곳에서도 툴팁이 뜬다 */}
              <rect
                x={centerX - slotWidth / 2}
                y={PLOT_TOP}
                width={slotWidth}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex((prev) => (prev === i ? null : prev))}
              />
            </g>
          );
        })}
      </svg>

      {/* 툴팁 — SVG 기본 <title>은 1초쯤 기다려야 뜨고 모양을 맞출 수 없어 직접 그린다.
          viewBox가 가로세로 같은 비율로 늘어나므로 %로 놓으면 확대·축소를 따라간다 */}
      {active && activeIndex !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-admin-line bg-admin-bg px-2.5 py-1.5 text-xs whitespace-nowrap shadow-sm"
          style={{
            left: `${((PLOT_LEFT + slotWidth * activeIndex + slotWidth / 2) / CHART_WIDTH) * 100}%`,
            top: `${((baselineY - Math.max(barHeight(active.rentalCnt), barHeight(active.returnCnt)) - 8) / CHART_HEIGHT) * 100}%`,
          }}
        >
          <p className="mb-0.5 font-medium text-admin-text">
            {active.date.slice(5).replace('-', '/')}
          </p>
          <p className="text-admin-muted">
            <Dot color={rentColor} />
            대여{' '}
            <span className="tabular-nums text-admin-text">
              {active.rentalCnt.toLocaleString()}
            </span>
            건
          </p>
          <p className="text-admin-muted">
            <Dot color={returnColor} />
            반납{' '}
            <span className="tabular-nums text-admin-text">
              {active.returnCnt.toLocaleString()}
            </span>
            건
          </p>
        </div>
      )}

      {/* 커서를 못 쓰는 경우를 위해 같은 값을 글로도 남긴다 */}
      <ul className="sr-only">
        {points.map((point) => (
          <li key={point.date}>
            {point.date} 대여 {point.rentalCnt}건, 반납 {point.returnCnt}건
          </li>
        ))}
      </ul>
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
