import { useMemo } from 'react';
import { BottomSheet, type SnapPoint } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { toStationStatus, type StationStatus } from '@/shared/ui/stationStatus';
import { ROUTE_BADGE } from '@/features/map/lib/routeBadges';
import {
  formatArrival,
  formatMinutes,
  sortSummaries,
  type RouteBadgeKind,
  type RouteSort,
  type RouteSummary,
} from '@/features/map/lib/routeMetrics';

/** 비교 시트는 두 단계만 쓴다 — 10-1 Peek(요약 한 줄) ↔ 10 확장(카드 목록) */
export type RouteCompareSnap = 'peek' | 'half';

const SORT_LABEL: Record<RouteSort, string> = {
  bikes: '확보 우선',
  flat: '오르막 적게',
};
const SORT_ORDER: RouteSort[] = ['bikes', 'flat'];

/** "도착 시 N대" 색 — 대여소 마커·뱃지와 같은 여유/보통/부족 판정을 쓴다 */
const BIKES_TEXT_CLASS: Record<StationStatus, string> = {
  high: 'text-status-high',
  mid: 'text-status-mid',
  low: 'text-status-low',
};

const START_LABEL = '바로 안내 시작';

interface RouteCompareSheetProps {
  open: boolean;
  snap: RouteCompareSnap;
  onSnapChange: (snap: RouteCompareSnap) => void;
  /** 원본 인덱스 순 요약. 정렬은 시트 안에서 한다 */
  summaries: RouteSummary[];
  /** 원본 인덱스 순 뱃지 */
  badges: (RouteBadgeKind | null)[];
  /** 후보를 받은 시각 — 도착 예정 시각 계산용 */
  fetchedAt: number;
  sort: RouteSort;
  onSortChange: (sort: RouteSort) => void;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  /** "바로 안내 시작" — 11 경로 상세는 후속 이슈라 지금은 안내만 띄운다 */
  onStart: (index: number) => void;
}

/**
 * 10 경로 비교·선택 시트. 후보 전체를 칩 기준으로 정렬해 카드로 보여주고, 카드를 탭하면 그 경로를 선택한다.
 * 뒤로가기(확장→Peek, Peek→이탈)와 dismiss 불가는 페이지가 URL·`dismissible`로 처리한다.
 */
export function RouteCompareSheet({
  open,
  snap,
  onSnapChange,
  summaries,
  badges,
  fetchedAt,
  sort,
  onSortChange,
  selectedIndex,
  onSelect,
  onStart,
}: RouteCompareSheetProps) {
  const sorted = useMemo(() => sortSummaries(summaries, sort), [summaries, sort]);
  const selected = selectedIndex === null ? null : (summaries[selectedIndex] ?? null);

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
            badge={badges[selected.index] ?? null}
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
              {SORT_ORDER.map((kind) => (
                <Chip key={kind} selected={sort === kind} onClick={() => onSortChange(kind)}>
                  {SORT_LABEL[kind]}
                </Chip>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500">
            예상 대수 = 내가 도착하는 시점에 남아 있을 자전거 대수
          </p>
          <ul className="flex flex-col gap-2.5">
            {sorted.map((summary) => (
              <RouteCard
                key={summary.index}
                summary={summary}
                badge={badges[summary.index] ?? null}
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

function BadgePill({ badge }: { badge: RouteBadgeKind }) {
  const { label, dotClass, pillClass } = ROUTE_BADGE[badge];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${pillClass}`}
    >
      <span aria-hidden className={`h-1 w-3 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}

function ExpectedBikes({ count, className = '' }: { count: number; className?: string }) {
  return (
    <span className={`font-semibold ${BIKES_TEXT_CLASS[toStationStatus(count)]} ${className}`}>
      도착 시 <span className="tabular-nums">{count}</span>대
    </span>
  );
}

interface RouteCardProps {
  summary: RouteSummary;
  badge: RouteBadgeKind | null;
  selected: boolean;
  onSelect: () => void;
  onStart: () => void;
}

/** 후보 한 장. 카드 어디를 눌러도 선택되고, 버튼은 선택한 경로로 안내를 시작한다 */
function RouteCard({ summary, badge, selected, onSelect, onStart }: RouteCardProps) {
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
        {badge === null ? null : (
          <div>
            <BadgePill badge={badge} />
          </div>
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-gray-900">
            {formatMinutes(summary.totalSec)}
          </span>
          <ExpectedBikes count={summary.expectedBikeCnt} className="text-sm" />
        </div>
        <p className="text-sm text-gray-500">
          오르막 <span className="tabular-nums">{summary.ascentM}</span>m · 도보{' '}
          {formatMinutes(summary.walkSec)}
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
  badge: RouteBadgeKind | null;
  fetchedAt: number;
  onStart: () => void;
}

/** 10-1 Peek — 선택한 경로 한 줄 요약 + 안내 시작. 위로 끌면 카드 목록이 나온다 */
function PeekSummary({ summary, badge, fetchedAt, onStart }: PeekSummaryProps) {
  const name = badge === null ? '선택한 경로' : `${ROUTE_BADGE[badge].label} 경로`;
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold tabular-nums text-gray-900">
            {formatMinutes(summary.totalSec)}
          </span>
          <ExpectedBikes count={summary.expectedBikeCnt} className="text-sm" />
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {name} · {formatArrival(fetchedAt, summary.totalSec)} 도착
        </p>
      </div>
      <Button onClick={onStart} className="shrink-0">
        {START_LABEL}
      </Button>
    </div>
  );
}
