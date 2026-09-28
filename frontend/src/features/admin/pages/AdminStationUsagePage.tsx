import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { readCssToken } from '@/shared/lib/cssToken';
import { posToLatLng } from '@/shared/lib/coords';
import { getStationUsage, type StationUsage } from '@/features/admin/api/adminStationUsage';
import { AdminMap } from '@/features/admin/components/AdminMap';
import { HeatmapLayer, type HeatmapCell } from '@/features/admin/components/HeatmapLayer';
import { DISTRICTS, STATION_DISTRICT, type District } from '@/features/admin/lib/stationDistricts';
import { AdminButton } from '@/features/admin/ui/AdminButton';
import { AdminDateInput, AdminFilterBar, AdminSelect } from '@/features/admin/ui/AdminFilters';
import { AdminPagination } from '@/features/admin/ui/AdminPagination';
import { AdminTable } from '@/features/admin/ui/AdminTable';
import { AdminTableStatus } from '@/features/admin/ui/AdminTableStatus';

type SortKey = 'total' | 'rent' | 'return';
type View = 'list' | 'map';

const SORT_LABEL: Record<SortKey, string> = { total: '합계', rent: '대여', return: '반납' };
const VIEW_LABEL: Record<View, string> = { list: '목록', map: '지도' };
/** 구 정보가 없는 대여소(표가 만들어진 뒤 새로 생긴 곳) */
const UNKNOWN_DISTRICT = '미분류';
const TOP_LIMIT = 100;
/** 목록 한 페이지에 보이는 대여소 수 — 지도는 페이지와 상관없이 조건에 맞는 곳을 모두 그린다 */
const PAGE_SIZE = 50;
/**
 * 처음 여는 날짜 — staging 시드 이용 기록이 9/23 02시에서 끊겨 있어 하루가 온전히 찬 9/22로 연다.
 * 시드를 발표일 기준으로 다시 넣으면 오늘(`todayString()`)로 바꾼다
 */
const DEFAULT_DATE = '2026-09-22';

/** 오늘을 input[type=date] 값 형식으로 — 관리자는 대전(KST)에서 쓴다 */
function todayString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 대여소들을 모두 담는 범위 — 구를 고르면 그 구 전체가 한눈에 들어오게 맞춘다 */
function boundsOf(points: { lat: number; lng: number }[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    south: Math.min(...lats),
    north: Math.max(...lats),
    west: Math.min(...lngs),
    east: Math.max(...lngs),
  };
}

interface UsageRow extends StationUsage {
  district: District | typeof UNKNOWN_DISTRICT;
  totalCnt: number;
  rank: number;
}

const countOf: Record<SortKey, (row: StationUsage) => number> = {
  total: (row) => row.rentCnt + row.returnCnt,
  rent: (row) => row.rentCnt,
  return: (row) => row.returnCnt,
};

/**
 * 01 대여소 이용 현황(#147) — 예전 "히트맵" 탭.
 *
 * 관리자가 관리할 대여소를 고르는 화면이라 **목록이 먼저**다. 고른 **하루**의 대여소별 합계를
 * 합계 많은 순 · 구 전체로 보여 준다. 기간 집계 API가 없어 히트맵 API를 24번 불러 더하므로(#149)
 * 여러 날은 보지 않는다 — 일주일 추이는 대여소 상세의 7일 그래프가 맡는다.
 * 정렬·구·"상위 100곳"은 받아 온 목록을 화면에서 거른다 — 조건마다 서버를 부르지 않는다.
 * 지도는 같은 조건을 그대로 쓰고, 원 크기는 같게 두고 색 농도로 이용량을 나타낸다.
 */
export function AdminStationUsagePage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(DEFAULT_DATE);
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [district, setDistrict] = useState<District | typeof UNKNOWN_DISTRICT | 'all'>('all');
  const [topOnly, setTopOnly] = useState(false);
  const [view, setView] = useState<View>('list');
  const [page, setPage] = useState(1);
  const [map, setMap] = useState<naver.maps.Map | null>(null);
  const [hover, setHover] = useState<{ stationId: string; x: number; y: number } | null>(null);

  // 날짜 칸을 지우면 빈 문자열이 온다
  const dateValid = date !== '';

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['adminStationUsage', date],
    queryFn: () => getStationUsage(date),
    enabled: dateValid,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const rows = useMemo<UsageRow[]>(() => {
    const count = countOf[sortKey];
    return (data ?? [])
      .map((usage) => ({
        ...usage,
        district: STATION_DISTRICT[usage.stationId] ?? UNKNOWN_DISTRICT,
        totalCnt: usage.rentCnt + usage.returnCnt,
      }))
      .filter((row) => district === 'all' || row.district === district)
      .sort((a, b) => count(b) - count(a) || a.stationName.localeCompare(b.stationName, 'ko'))
      .slice(0, topOnly ? TOP_LIMIT : undefined)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [data, sortKey, district, topOnly]);

  // 순위는 거른 목록 전체 기준이라, 페이지를 넘겨도 51위·52위…로 이어진다
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /** 조건이 바뀌면 목록이 달라지므로 첫 페이지로 돌아간다 */
  const changeSortKey = (key: SortKey) => {
    setSortKey(key);
    setPage(1);
  };

  const rowById = useMemo(() => new Map(rows.map((row) => [row.stationId, row])), [rows]);

  // 지도 색은 정렬 기준을 따른다 — 대여는 대여색, 반납은 반납색, 합계는 합계색
  const heatColor = readCssToken(
    sortKey === 'rent'
      ? '--color-admin-heat-rent'
      : sortKey === 'return'
        ? '--color-admin-heat-return'
        : '--color-admin-heat-total',
  );
  const cells = useMemo<HeatmapCell[]>(
    () =>
      rows.map((row) => ({
        stationId: row.stationId,
        ...posToLatLng(row),
        count: countOf[sortKey](row),
        color: heatColor,
      })),
    [rows, sortKey, heatColor],
  );
  const maxCount = useMemo(() => Math.max(0, ...cells.map((cell) => cell.count)), [cells]);
  const hovered = hover === null ? null : (rowById.get(hover.stationId) ?? null);

  const openStation = (stationId: string) => navigate(`/admin/stations/${stationId}`);

  /*
   * 구를 고르면 **그 구 전체가 한눈에 보이는 만큼만** 확대한다 — 대전 전체 줌에서는 원이 거의 다
   * 겹쳐서, 관리할 구를 고르면 그 구로 좁혀 보이게 한다. "구 전체"면 전체 대여소에 맞춘다.
   * **구가 바뀔 때만** 맞춘다(지도를 새로 열 때 포함). 날짜·정렬·상위 100을 바꿀 때마다 맞추면
   * 사용자가 확대해 둔 지도가 튄다.
   */
  const fittedRef = useRef<{ map: naver.maps.Map; district: string } | null>(null);
  useEffect(() => {
    if (map === null || data === undefined) return;
    const fitted = fittedRef.current;
    if (fitted !== null && fitted.map === map && fitted.district === district) return;
    const points = data
      .filter(
        (usage) =>
          district === 'all' ||
          (STATION_DISTRICT[usage.stationId] ?? UNKNOWN_DISTRICT) === district,
      )
      .map((usage) => posToLatLng(usage));
    if (points.length === 0) return;
    fittedRef.current = { map, district };
    const { south, north, west, east } = boundsOf(points);
    map.fitBounds(
      new naver.maps.LatLngBounds(
        new naver.maps.LatLng(south, west),
        new naver.maps.LatLng(north, east),
      ),
      { top: 40, right: 40, bottom: 40, left: 40 },
    );
  }, [map, data, district]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-semibold">대여소 이용 현황</h2>
          <span className="text-sm text-admin-muted tabular-nums">
            {dateValid ? `${date} · ${rows.length}곳` : '날짜를 골라 주세요'}
          </span>
        </div>
        <Segmented value={view} labels={VIEW_LABEL} onChange={setView} ariaLabel="보기 방식" />
      </div>

      <AdminFilterBar>
        <AdminDateInput
          aria-label="조회 날짜"
          value={date}
          max={todayString()}
          onChange={(e) => {
            setDate(e.target.value);
            setPage(1);
          }}
        />
        <AdminSelect
          aria-label="정렬 기준"
          value={sortKey}
          onChange={(e) => changeSortKey(e.target.value as SortKey)}
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              {SORT_LABEL[key]} 많은 순
            </option>
          ))}
        </AdminSelect>
        <AdminSelect
          aria-label="구"
          value={district}
          onChange={(e) => {
            setDistrict(e.target.value as typeof district);
            setPage(1);
          }}
        >
          <option value="all">구 전체</option>
          {DISTRICTS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value={UNKNOWN_DISTRICT}>{UNKNOWN_DISTRICT}</option>
        </AdminSelect>
        <label className="flex h-9 cursor-pointer items-center gap-2 px-1 text-sm text-admin-text">
          <input
            type="checkbox"
            checked={topOnly}
            onChange={(e) => {
              setTopOnly(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 accent-admin-indicator"
          />
          상위 {TOP_LIMIT}곳만 보기
        </label>
      </AdminFilterBar>

      {view === 'list' ? (
        <div className="rounded-lg border border-admin-line">
          <AdminTable clickableRows>
            <thead>
              <tr>
                <th className="w-16">순위</th>
                <th>대여소명</th>
                <th className="w-24">구</th>
                <SortableHeader
                  label="대여"
                  active={sortKey === 'rent'}
                  onClick={() => changeSortKey('rent')}
                />
                <SortableHeader
                  label="반납"
                  active={sortKey === 'return'}
                  onClick={() => changeSortKey('return')}
                />
                <SortableHeader
                  label="합계"
                  active={sortKey === 'total'}
                  onClick={() => changeSortKey('total')}
                />
              </tr>
            </thead>
            <tbody>
              <AdminTableStatus
                colSpan={6}
                isPending={dateValid && isPending}
                isError={isError}
                onRetry={() => void refetch()}
                isEmpty={rows.length === 0}
                emptyText={dateValid ? '이 날짜에 이용 기록이 없습니다' : '날짜를 골라 주세요'}
              />
              {pageRows.map((row) => (
                <tr key={row.stationId} onClick={() => openStation(row.stationId)}>
                  <td className="tabular-nums text-admin-muted">{row.rank}</td>
                  <td className="truncate">{row.stationName}</td>
                  <td className="text-admin-muted">{row.district}</td>
                  <td className="text-right tabular-nums">{row.rentCnt.toLocaleString()}</td>
                  <td className="text-right tabular-nums">{row.returnCnt.toLocaleString()}</td>
                  <td className="text-right font-medium tabular-nums">
                    {row.totalCnt.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
          {rows.length > 0 && (
            <AdminPagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={rows.length}
              onChange={setPage}
            />
          )}
        </div>
      ) : (
        <div className="relative min-h-[520px] flex-1 overflow-hidden rounded-lg border border-admin-line">
          <AdminMap onReady={setMap} />
          {map && (
            <HeatmapLayer
              map={map}
              cells={cells}
              maxCount={maxCount}
              onSelectStation={openStation}
              onHover={setHover}
            />
          )}

          {/* 범례 */}
          <div className="absolute top-3 right-3 rounded-md border border-admin-line bg-admin-bg/95 px-3 py-2 text-xs text-admin-muted">
            <span
              aria-hidden
              className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-[-1px]"
              style={{ backgroundColor: heatColor }}
            />
            진할수록 {SORT_LABEL[sortKey]} 건수가 많은 대여소 · 클릭하면 상세
          </div>

          {/* 커서 미리보기 — 원 바로 위에 띄운다 */}
          {hover && hovered && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-admin-line bg-admin-bg px-3 py-2 text-xs shadow-md"
              style={{ left: hover.x, top: hover.y - 10 }}
            >
              <p className="font-semibold text-admin-text">{hovered.stationName}</p>
              <p className="mt-0.5 text-admin-muted tabular-nums">
                대여 {hovered.rentCnt.toLocaleString()} · 반납 {hovered.returnCnt.toLocaleString()}
              </p>
            </div>
          )}

          {dateValid && isPending && (
            <div className="absolute inset-x-0 top-3 flex justify-center">
              <span className="rounded-md bg-admin-bg/95 px-3 py-1.5 text-xs text-admin-muted">
                불러오는 중…
              </span>
            </div>
          )}
          {isError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-admin-bg/80">
              <p className="text-sm text-admin-muted">이용 현황을 불러오지 못했습니다.</p>
              <AdminButton variant="secondary" size="sm" onClick={() => void refetch()}>
                다시 시도
              </AdminButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 정렬 기준을 바꾸는 표 머리 — 지금 기준이면 굵게 ▼.
 * 숫자 열이라 오른쪽에 붙인다. 표 공통 스타일(`[&_th]:text-left`)이 th의 text-right를 이겨서
 * 버튼 자체를 오른쪽으로 민다.
 */
function SortableHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th className="w-24 text-right" aria-sort={active ? 'descending' : 'none'}>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center justify-end gap-1 ${active ? 'font-semibold text-admin-text' : ''}`}
      >
        {label}
        <span aria-hidden className={active ? '' : 'opacity-0'}>
          ▼
        </span>
      </button>
    </th>
  );
}

/** 몇 가지 중 하나를 고르는 버튼 묶음(보기 방식) */
function Segmented<T extends string>({
  value,
  labels,
  onChange,
  ariaLabel,
}: {
  value: T;
  labels: Record<T, string>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="flex h-9 overflow-hidden rounded-md border border-admin-line"
      role="group"
      aria-label={ariaLabel}
    >
      {(Object.keys(labels) as T[]).map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`px-4 text-sm font-medium transition-colors ${
            value === key
              ? 'bg-admin-primary text-white'
              : 'bg-admin-bg text-admin-muted hover:bg-admin-panel'
          }`}
        >
          {labels[key]}
        </button>
      ))}
    </div>
  );
}
