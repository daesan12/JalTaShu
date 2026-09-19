import { useMemo } from 'react';
import type { RouteType } from '@/shared/api/types';
import { BottomSheet, type SnapPoint } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { toStationStatus, type StationStatus } from '@/shared/ui/stationStatus';
import { ROUTE_TYPE_STYLE } from '@/features/map/lib/routeTypeStyle';
import {
  formatArrival,
  formatSecondsAsMinutes,
  sortSummaries,
  type RouteSort,
  type RouteSummary,
} from '@/features/map/lib/routeMetrics';

/** 비교 시트는 두 단계만 쓴다 — 10 확장(카드 목록, 기본) ↔ 10-1 Peek(아래로 끌었을 때 요약 한 줄) */
export type RouteCompareSnap = 'peek' | 'half';

const SORT_LABEL: Record<RouteSort, string> = {
  bikes: '확보 우선',
  flat: '오르막 적게',
};
const SORT_ORDER: RouteSort[] = ['bikes', 'flat'];

/** 예상 대수가 아직 응답에 없을 때, 그 값에 기대는 칩에 붙는 안내 */
const BIKES_PENDING_NOTICE = '확보 우선은 예상 대수 준비 중이에요. 곧 켜집니다.';

/** "도착 시 N대" 색 — 대여소 마커·뱃지와 같은 여유/보통/부족 판정을 쓴다 */
const BIKES_TEXT_CLASS: Record<StationStatus, string> = {
  high: 'text-status-high',
  mid: 'text-status-mid',
  low: 'text-status-low',
  unknown: 'text-gray-500',
};

const START_LABEL = '바로 안내 시작';

interface RouteCompareSheetProps {
  open: boolean;
  snap: RouteCompareSnap;
  onSnapChange: (snap: RouteCompareSnap) => void;
  /** 원본 인덱스 순 요약. 정렬은 시트 안에서 한다 */
  summaries: RouteSummary[];
  /** 후보를 받은 시각 — 도착 예정 시각 계산용 */
  fetchedAt: number;
  /** 켜져 있는 정렬 칩들 (0~2개, SORT_ORDER 순서 유지) */
  sort: RouteSort[];
  onSortChange: (sort: RouteSort[]) => void;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onStart: (index: number) => void;
}

/**
 * 10 경로 비교·선택 시트. 후보를 칩 기준으로 정렬해 카드로 보여주고, 카드를 탭하면 그 경로를 선택한다.
 * 기본은 확장 상태, 아래로 끌면 Peek. Peek 이하로는 닫히지 않고(`dismissible`) 닫기는 페이지의 뒤로가기·← 버튼.
 *
 * 후보는 서버가 종류(`type`)를 붙여 주므로 그 라벨을 그대로 쓴다 — 후보가 2개뿐이라 숫자를 비교해
 * 순위를 매기던 강점 뱃지는 없앴다(2026-09-17).
 */
export function RouteCompareSheet({
  open,
  snap,
  onSnapChange,
  summaries,
  fetchedAt,
  sort,
  onSortChange,
  selectedIndex,
  onSelect,
  onStart,
}: RouteCompareSheetProps) {
  const sorted = useMemo(() => sortSummaries(summaries, sort), [summaries, sort]);
  const selected = selectedIndex === null ? null : (summaries[selectedIndex] ?? null);
  // 예상 대수가 하나도 안 오면(예측 모델 대기) 그 값으로 줄 세우는 칩은 아직 쓸 수 없다
  const bikesReady = summaries.some((s) => s.expectedBikeCnt !== undefined);

  /** 칩 하나를 켜고 끈다 — 우선순위가 예측 가능하도록 결과는 항상 SORT_ORDER 순서 */
  function toggleSort(kind: RouteSort) {
    const next = sort.includes(kind) ? sort.filter((s) => s !== kind) : [...sort, kind];
    onSortChange(SORT_ORDER.filter((s) => next.includes(s)));
  }

  // 공용 시트는 4단계를 돌려주지만 여기서는 peek 아니면 확장으로만 본다
  function changeSnap(next: SnapPoint) {
    onSnapChange(next === 'peek' ? 'peek' : 'half');
  }

  return (
    <BottomSheet
      open={open}
      snapPoint={snap}
      onSnapChange={changeSnap}
      // Peek 이하로는 닫히지 않으므로 호출될 일이 없다. 닫기는 뒤로가기·← 버튼(페이지)
      onClose={() => onSnapChange('peek')}
      backdrop={false}
      dismissible={false}
    >
      {snap === 'peek' ? (
        selected === null ? null : (
          <PeekSummary
            summary={selected}
            fetchedAt={fetchedAt}
            onStart={() => onStart(selected.index)}
          />
        )
      ) : (
        <div className="flex flex-col gap-3 pb-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-lg font-semibold text-gray-900">
              추천 경로 <span className="tabular-nums">{summaries.length}</span>개
            </p>
            <div className="flex gap-1.5">
              {SORT_ORDER.map((kind) => {
                const pending = kind === 'bikes' && !bikesReady;
                return (
                  <Chip
                    key={kind}
                    selected={sort.includes(kind)}
                    disabled={pending}
                    className={pending ? 'opacity-50' : ''}
                    onClick={() => toggleSort(kind)}
                  >
                    {SORT_LABEL[kind]}
                  </Chip>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {bikesReady
              ? '예상 대수 = 내가 도착하는 시점에 남아 있을 자전거 대수'
              : BIKES_PENDING_NOTICE}
          </p>
          <ul className="flex flex-col gap-2.5">
            {sorted.map((summary) => (
              <RouteCard
                key={summary.index}
                summary={summary}
                selected={summary.index === selectedIndex}
                onSelect={() => onSelect(summary.index)}
                onStart={() => onStart(summary.index)}
              />
            ))}
          </ul>
        </div>
      )}
    </BottomSheet>
  );
}

/** 일반 경로 — 현재 프로젝트의 인라인 SVG 아이콘 방식에 맞춘 나침반 */
function CompassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" />
    </svg>
  );
}

/** 오르막 회피 경로 — 급경사가 아닌 완만한 상승선을 표현한다 */
function GentleSlopeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 17h3.5c1.2 0 2.1-.5 2.8-1.5l3.1-4.4c.7-1 1.6-1.5 2.8-1.5H21" />
      <path d="m18 6.6 3 3-3 3" />
    </svg>
  );
}

/** 후보 종류 라벨 — 서버가 준 `type` 그대로 */
function TypePill({ type }: { type: RouteType }) {
  const { label, dotClass, pillClass } = ROUTE_TYPE_STYLE[type];
  const visualClass = type === 'UPHILL' ? 'bg-primary-light text-primary' : pillClass;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${visualClass}`}
    >
      {type === 'BIKE' ? (
        <CompassIcon />
      ) : type === 'UPHILL' ? (
        <GentleSlopeIcon />
      ) : (
        <span aria-hidden className={`h-1 w-3 rounded-full ${dotClass}`} />
      )}
      {label}
    </span>
  );
}

/** 예상 대수는 아직 안 올 수 있다 — 없으면 아무것도 그리지 않는다 */
function ExpectedBikes({ count, className = '' }: { count?: number; className?: string }) {
  if (count === undefined) return null;
  return (
    <span className={`font-semibold ${BIKES_TEXT_CLASS[toStationStatus(count)]} ${className}`}>
      도착 시 <span className="tabular-nums">{count}</span>대
    </span>
  );
}

interface RouteCardProps {
  summary: RouteSummary;
  selected: boolean;
  onSelect: () => void;
  onStart: () => void;
}

/** 후보 한 장. 카드 어디를 눌러도 선택되고, 버튼은 선택한 경로로 안내를 시작한다 */
function RouteCard({ summary, selected, onSelect, onStart }: RouteCardProps) {
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        className={`flex flex-col gap-2 rounded-2xl border p-4 transition-[background-color,border-color] duration-150 ${
          selected
            ? 'border-primary bg-primary-light'
            : 'border-gray-200 bg-surface active:bg-gray-50'
        }`}
      >
        <div>
          <TypePill type={summary.type} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-gray-900">
            {formatSecondsAsMinutes(summary.totalSec)}
          </span>
          <ExpectedBikes count={summary.expectedBikeCnt} className="text-sm" />
        </div>
        <p className="text-sm text-gray-500">
          오르막 <span className="tabular-nums">{summary.ascentM}</span>m · 도보{' '}
          {formatSecondsAsMinutes(summary.walkSec)}
        </p>
        <Button
          full
          variant={selected ? 'primary' : 'line'}
          onClick={(e) => {
            // 카드 선택과 겹치지 않게 — 버튼은 안내 시작만
            e.stopPropagation();
            onStart();
          }}
        >
          {START_LABEL}
        </Button>
      </div>
    </li>
  );
}

interface PeekSummaryProps {
  summary: RouteSummary;
  fetchedAt: number;
  onStart: () => void;
}

/** 10-1 Peek — 선택한 경로 한 줄 요약 + 안내 시작. 위로 끌면 카드 목록으로 돌아간다 */
function PeekSummary({ summary, fetchedAt, onStart }: PeekSummaryProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold tabular-nums text-gray-900">
            {formatSecondsAsMinutes(summary.totalSec)}
          </span>
          <ExpectedBikes count={summary.expectedBikeCnt} className="text-sm" />
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {ROUTE_TYPE_STYLE[summary.type].label} 경로 ·{' '}
          {formatArrival(fetchedAt, summary.totalSec)} 도착
        </p>
      </div>
      <Button onClick={onStart} className="shrink-0">
        {START_LABEL}
      </Button>
    </div>
  );
}
