import { useMemo } from 'react';
import type { RouteType, StationStrategy } from '@/shared/api/types';
import { BottomSheet, type SnapPoint } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { toStationStatus, type StationStatus } from '@/shared/ui/stationStatus';
import { ROUTE_TYPE_STYLE } from '@/features/map/lib/routeTypeStyle';
import { formatBikes } from '@/features/map/lib/bikeCount';
import { formatDistance } from '@/shared/lib/format';
import {
  bikesSortBlock,
  formatArrival,
  formatSecondsAsMinutes,
  sortSummaries,
  type BikesSortBlock,
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

/**
 * 확보 우선 칩을 못 쓸 때 **누르면** 띄우는 안내.
 *
 * 칩을 `disabled`로 두지 않는다 — 비활성 버튼은 포커스가 가지 않고 터치에서는 툴팁도 없어서
 * 왜 못 쓰는지 알 방법이 칩 자체에 없다. 누를 수 있게 두고 정렬 대신 이유를 알려준다.
 */
const BIKES_BLOCK_NOTICE: Record<BikesSortBlock, string> = {
  'no-data': '예상 대수를 받지 못해 확보 우선을 쓸 수 없어요.',
  'all-equal': '같은 대여소에서 빌리는 경로라 확보 대수가 같아요.',
};

/** 칩 아래 설명 — 새로 보이기 시작한 "도착 시 N대"가 무슨 숫자인지 알려준다 */
const BIKES_HINT = '예상 대수 = 내가 도착하는 시점에 남아 있을 자전거 대수';

/** "도착 시 N대" 색 — 대여소 마커·뱃지와 같은 여유/보통/부족 판정을 쓴다 */
const BIKES_TEXT_CLASS: Record<StationStatus, string> = {
  high: 'text-status-high',
  mid: 'text-status-mid',
  low: 'text-status-low',
  unknown: 'text-gray-500',
};

const START_LABEL = '이 경로로 안내 시작';

const ROUTE_CARD_LABEL: Record<RouteType, string> = {
  BIKE: '일반 경로',
  UPHILL: '오르막 적은 경로',
  WALK: '도보 경로',
};

function routeCardLabel(type: RouteType, strategy: StationStrategy): string {
  const base = ROUTE_CARD_LABEL[type];
  return strategy === 'BIKE_SECURE' && type !== 'WALK' ? `확보 우선 ${base}` : base;
}

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
  /** 확보 우선 칩을 못 쓸 때 이유를 띄운다 */
  showToast: (message: string) => void;
}

/**
 * 10 경로 비교·선택 시트. 후보를 칩 기준으로 정렬해 카드로 보여주고, 카드를 탭하면 그 경로를 선택한다.
 * 기본은 확장 상태, 아래로 끌면 Peek. Peek 이하로는 닫히지 않고(`dismissible`) 닫기는 페이지의 뒤로가기·← 버튼.
 *
 * 서버의 경로 종류(`type`)와 대여소 선택 기준(`stationStrategy`) 조합을 카드 라벨로 표시한다.
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
  showToast,
}: RouteCompareSheetProps) {
  const sorted = useMemo(() => sortSummaries(summaries, sort), [summaries, sort]);
  const selected = selectedIndex === null ? null : (summaries[selectedIndex] ?? null);
  // 값이 없거나 후보끼리 같으면 확보 우선으로 줄 세워도 순서가 바뀌지 않는다
  const bikesBlock = useMemo(() => bikesSortBlock(summaries), [summaries]);

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
            <div>
              <p className="text-lg font-semibold text-gray-900">경로 비교</p>
              <p className="mt-0.5 text-xs text-gray-500">
                <span className="tabular-nums">{summaries.length}</span>개 경로 중 하나를
                선택하세요.
              </p>
            </div>
            <div className="flex gap-1.5">
              {SORT_ORDER.map((kind) => {
                const blocked = kind === 'bikes' ? bikesBlock : null;
                return (
                  <Chip
                    key={kind}
                    selected={sort.includes(kind) && blocked === null}
                    // disabled 대신 aria-disabled — 눌러서 이유를 들을 수 있어야 한다
                    aria-disabled={blocked !== null}
                    className={blocked === null ? '' : 'opacity-50'}
                    onClick={() =>
                      blocked === null ? toggleSort(kind) : showToast(BIKES_BLOCK_NOTICE[blocked])
                    }
                  >
                    {SORT_LABEL[kind]}
                  </Chip>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-gray-500">{BIKES_HINT}</p>
          <ul className="flex flex-col gap-2.5">
            {sorted.map((summary) => (
              <RouteCard
                key={summary.index}
                summary={summary}
                selected={summary.index === selectedIndex}
                onSelect={() => onSelect(summary.index)}
              />
            ))}
          </ul>
          <Button
            full
            disabled={selected === null}
            onClick={() => selected && onStart(selected.index)}
          >
            {START_LABEL}
          </Button>
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
function TypePill({ type, strategy }: { type: RouteType; strategy: StationStrategy }) {
  const { dotClass, pillClass } = ROUTE_TYPE_STYLE[type];
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
      {routeCardLabel(type, strategy)}
    </span>
  );
}

/** 예상 대수는 아직 안 올 수 있다 — 없으면 아무것도 그리지 않는다 (서버가 `null`로도 준다) */
function ExpectedBikes({ count, className = '' }: { count?: number | null; className?: string }) {
  if (count == null) return null;
  return (
    <span className={`font-semibold ${BIKES_TEXT_CLASS[toStationStatus(count)]} ${className}`}>
      도착 시 <span className="tabular-nums">{formatBikes(count)}</span>대
    </span>
  );
}

interface RouteCardProps {
  summary: RouteSummary;
  selected: boolean;
  onSelect: () => void;
}

/** 후보 한 장. 카드는 경로 선택만 담당하고 안내 시작은 시트 아래 공통 버튼이 담당한다. */
function RouteCard({ summary, selected, onSelect }: RouteCardProps) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={`flex w-full flex-col gap-2 rounded-2xl border p-4 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none ${
          selected
            ? 'border-primary bg-primary-light ring-1 ring-primary/20'
            : 'border-gray-200 bg-surface hover:border-primary/40 hover:bg-primary-light/35 active:bg-primary-light/60'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <TypePill type={summary.type} strategy={summary.stationStrategy} />
          {selected ? (
            <span className="text-xs font-semibold text-primary">선택됨</span>
          ) : (
            <span className="text-xs text-gray-400">선택</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">이동 시간</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-gray-900">
              {formatSecondsAsMinutes(summary.totalSec)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">도착 예상</p>
            {summary.expectedBikeCnt === undefined ? (
              <p className="mt-1 text-sm font-semibold text-gray-400">정보 없음</p>
            ) : (
              <ExpectedBikes count={summary.expectedBikeCnt} className="mt-0.5 block text-lg" />
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500">
          {summary.totalDistanceM === undefined
            ? '거리 정보 없음'
            : formatDistance(summary.totalDistanceM)}{' '}
          · 오르막 <span className="tabular-nums">{summary.ascentM}</span>m
          {summary.walkSec > 0 ? (
            <>
              {' '}
              · 도보 <span className="tabular-nums">{formatSecondsAsMinutes(summary.walkSec)}</span>
            </>
          ) : null}
        </p>
      </button>
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
          {routeCardLabel(summary.type, summary.stationStrategy)} ·{' '}
          {formatArrival(fetchedAt, summary.totalSec)}{' '}
          도착
        </p>
      </div>
      <Button onClick={onStart} className="shrink-0">
        {START_LABEL}
      </Button>
    </div>
  );
}
