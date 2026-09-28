import { useState, type CSSProperties } from 'react';
import type { StationForecastPoint } from '@/shared/api/types';
import { formatBikes } from '@/features/map/lib/bikeCount';
import { STATION_STATUS_LABEL, type StationStatus } from '@/shared/ui/stationStatus';
import { describeLowestUpcoming, toForecastTimeline } from '@/features/map/lib/stationForecastTimeline';

/**
 * 대여소 예상 대수 (2-1) — 대표 예측 시점을 드래그해서 보는 타임 다이얼.
 *
 * 15분 응답은 현재·5·10·15분을, 60분 응답은 현재·5·10·15·30·45·60분을 보여준다.
 * 다이얼은 받은 예측값 중 하나를 고를 뿐 값을 계산하거나 보간하지 않는다.
 */

const STATUS_TEXT_CLASS: Record<StationStatus, string> = {
  high: 'text-status-high',
  mid: 'text-status-mid',
  low: 'text-status-low',
  unknown: 'text-gray-400',
};

const STATUS_PANEL_CLASS: Record<StationStatus, string> = {
  high: 'border-primary/15 bg-primary-light',
  mid: 'border-amber-200 bg-amber-50',
  low: 'border-red-200 bg-red-50',
  unknown: 'border-gray-200 bg-gray-50',
};

interface StationForecastChartProps {
  points: StationForecastPoint[];
  /** 현재 대수. 모르면 null */
  currentBikes: number | null;
}

export function StationForecastChart({ points, currentBikes }: StationForecastChartProps) {
  const timeline = toForecastTimeline(points, currentBikes);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeIndex = Math.min(selectedIndex, timeline.length - 1);
  const selected = timeline[safeIndex] ?? timeline[0];
  const progress = timeline.length <= 1 ? 0 : (safeIndex / (timeline.length - 1)) * 100;
  const edgeInset = 50 / timeline.length;
  const trackWidth = 100 - edgeInset * 2;
  const bikesText = selected.bikes === null ? '–' : formatBikes(selected.bikes);
  const statusText = selected.bikes === null ? '정보 없음' : STATION_STATUS_LABEL[selected.status];

  // 다이얼을 끝까지 끌어보지 않아도 위험한 때를 알 수 있게 미리 짚어 준다 — 의미 있게 줄 때만(#154)
  const lowestHint = describeLowestUpcoming(timeline);
  const rangeLabel = timeline[timeline.length - 1]?.label ?? '';

  return (
    <section aria-label="현재와 향후 예상 자전거 수" className="rounded-[22px] border border-line bg-surface-soft/65 p-3.5">
      <div
        className={`flex min-h-[96px] items-center justify-between gap-4 rounded-2xl border px-4 py-3 shadow-sm transition-[background-color,border-color] duration-200 ${STATUS_PANEL_CLASS[selected.status]}`}
      >
        <div>
          <p className="text-xs font-semibold text-muted">
            {selected.horizon === 0 ? '현재 대여 가능' : `${selected.label} 예상`}
            {/* 고른 시점이 몇 시인지 — "30분 뒤"를 사용자가 암산하지 않도록 */}
            {selected.clock === null ? null : (
              <span className="font-medium text-gray-400"> · {selected.clock}</span>
            )}
          </p>
          <p className="mt-1 flex items-baseline gap-1 text-ink">
            <span className="text-[34px] font-bold leading-none tabular-nums">{bikesText}</span>
            {selected.bikes === null ? null : <span className="text-sm font-semibold">대</span>}
          </p>
        </div>
        <span
          className={`rounded-full bg-surface/80 px-3 py-1.5 text-sm font-bold shadow-sm ${STATUS_TEXT_CLASS[selected.status]}`}
        >
          {statusText}
        </span>
      </div>

      <div className="mt-4">
        <input
          type="range"
          min={0}
          max={timeline.length - 1}
          step={1}
          value={safeIndex}
          onChange={(event) => setSelectedIndex(Number(event.currentTarget.value))}
          aria-label="예상 시간 선택"
          aria-valuetext={`${selected.label}, ${selected.bikes === null ? '정보 없음' : `${bikesText}대 ${statusText}`}`}
          className="forecast-range block touch-pan-y"
          style={
            {
              '--forecast-progress': `${progress}%`,
              marginInlineStart: `${edgeInset}%`,
              width: `${trackWidth}%`,
            } as CSSProperties
          }
        />

        <ol
          className="mt-1 grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${timeline.length}, minmax(0, 1fr))` }}
        >
          {timeline.map((item, index) => {
            const active = index === safeIndex;
            return (
              <li key={item.horizon} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  aria-pressed={active}
                  className={`w-full rounded-xl px-0.5 py-1.5 text-center transition-[background-color,color,scale] duration-100 active:scale-95 ${
                    active ? 'bg-surface text-ink shadow-sm' : 'text-muted'
                  }`}
                >
                  <span className="block whitespace-nowrap text-[10px] font-semibold sm:text-[11px]">{item.label}</span>
                  <span className={`mt-0.5 block text-[11px] font-bold tabular-nums sm:text-xs ${active ? STATUS_TEXT_CLASS[item.status] : ''}`}>
                    {item.bikes === null ? '–' : `${formatBikes(item.bikes)}대`}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {lowestHint === null ? null : lowestHint.kind === 'drop' ? (
        <p className="mt-3 text-center text-xs text-muted">
          앞으로 {rangeLabel} 중 가장 적을 때{' '}
          <span className="font-semibold text-ink">
            {lowestHint.item.label}{' '}
            <span className="tabular-nums">{formatBikes(lowestHint.item.bikes ?? 0)}</span>대
          </span>
        </p>
      ) : (
        <p className="mt-3 text-center text-xs text-muted">
          앞으로 {rangeLabel} 동안 크게 줄지 않을 것으로 예상돼요
        </p>
      )}
      <p className="mt-2 text-center text-[11px] font-medium text-gray-400">
        다이얼을 좌우로 움직여 예상 시점을 확인하세요
      </p>
    </section>
  );
}
