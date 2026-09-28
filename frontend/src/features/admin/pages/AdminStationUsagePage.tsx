import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { readCssToken } from '@/shared/lib/cssToken';
import { posToLatLng } from '@/shared/lib/coords';
import {
  getStationUsage,
  sumHours,
  type StationUsage,
} from '@/features/admin/api/adminStationUsage';
import { AdminMap } from '@/features/admin/components/AdminMap';
import { HeatmapLayer, type HeatmapCell } from '@/features/admin/components/HeatmapLayer';
import { DISTRICTS, STATION_DISTRICT, type District } from '@/features/admin/lib/stationDistricts';
import { AdminButton } from '@/features/admin/ui/AdminButton';
import { AdminDateInput, AdminFilterBar, AdminSelect } from '@/features/admin/ui/AdminFilters';
import { AdminPagination } from '@/features/admin/ui/AdminPagination';
import { AdminTable } from '@/features/admin/ui/AdminTable';
import { AdminTableStatus } from '@/features/admin/ui/AdminTableStatus';

/** deficit = 빠져나간 곳 순(순증감 작은 순), surplus = 쌓인 곳 순(순증감 큰 순) */
type SortKey = 'deficit' | 'surplus' | 'total' | 'rent' | 'return';
type CountKey = 'total' | 'rent' | 'return';
type View = 'list' | 'map';
type TimeWindow = 'all' | 'morning' | 'day' | 'evening' | 'night';

const SORT_LABEL: Record<SortKey, string> = {
  deficit: '빠져나간 곳 순',
  surplus: '쌓인 곳 순',
  total: '합계 많은 순',
  rent: '대여 많은 순',
  return: '반납 많은 순',
};
/** 지도 범례의 "진할수록 ○○ 건수가 많은" — 대여·반납·합계 정렬일 때만 쓴다 */
const COUNT_LABEL: Record<CountKey, string> = { total: '합계', rent: '대여', return: '반납' };
const VIEW_LABEL: Record<View, string> = { list: '목록', map: '지도' };

/** [시작 시, 끝 시) — 끝이 시작보다 작으면 자정을 넘긴다(밤 20–07시) */
const TIME_WINDOW_RANGE: Record<TimeWindow, readonly [number, number]> = {
  all: [0, 24],
  morning: [7, 10],
  day: [10, 17],
  evening: [17, 20],
  night: [20, 7],
};
const TIME_WINDOW_LABEL: Record<TimeWindow, string> = {
  all: '하루 전체',
  morning: '출근 07–10시',
  day: '낮 10–17시',
  evening: '퇴근 17–20시',
  night: '밤 20–07시',
};

/** 시간대에 들어가는 시(hour) 목록 — 밤 20–07시는 20…23, 0…6 */
function hoursOf(window: TimeWindow): number[] {
  const [from, to] = TIME_WINDOW_RANGE[window];
  const count = (to - from + 24) % 24 || 24;
  return Array.from({ length: count }, (_, i) => (from + i) % 24);
}

const ALL_HOURS = hoursOf('all');
/** 지도 하단 슬라이더 재생 — 이 간격마다 한 시간씩 넘긴다(23시 다음은 0시로 돌아간다) */
const PLAY_INTERVAL_MS = 1000;

/** 슬라이더의 "08:00–09:00" */
function hourLabel(hour: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hour)}:00–${pad(hour + 1)}:00`;
}

/** 한 대여소의 h시 한 시간 값 — 지도 농도 기준(하루 중 가장 큰 한 시간)을 구할 때 쓴다 */
function hourValueOf(usage: StationUsage, hour: number, key: SortKey): number {
  const rent = usage.rents[hour];
  const ret = usage.returns[hour];
  if (key === 'rent') return rent;
  if (key === 'return') return ret;
  if (key === 'total') return rent + ret;
  return Math.abs(ret - rent);
}

/**
 * 타슈관제센터(정비대기 포함) — 시민 대여소가 아니라 재배치·정비 이동 지점이라 뺀다(#159).
 * 트럭 재배치가 대여·반납으로 찍혀 순위를 왜곡한다(AI 파트도 같은 이유로 학습에서 뺀다).
 */
const CONTROL_CENTER_IDS: ReadonlySet<string> = new Set(['ST1220', 'ST0001']);

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
  /** 고른 시간대만 더한 값 */
  rentCnt: number;
  returnCnt: number;
  totalCnt: number;
  /** 순증감 = 반납 − 대여. − 면 빠져나감(보충), + 면 쌓임(회수) */
  netCnt: number;
  rank: number;
}

type CountedRow = Omit<UsageRow, 'rank'>;

/** 정렬 값 — 클수록 위로 */
const sortValueOf: Record<SortKey, (row: CountedRow) => number> = {
  deficit: (row) => -row.netCnt,
  surplus: (row) => row.netCnt,
  total: (row) => row.totalCnt,
  rent: (row) => row.rentCnt,
  return: (row) => row.returnCnt,
};

const isNetSort = (key: SortKey): key is 'deficit' | 'surplus' =>
  key === 'deficit' || key === 'surplus';

/** 순증감 표기 — "+83", "−164"(빼기 기호), "0" */
function formatNet(net: number): string {
  if (net > 0) return `+${net.toLocaleString()}`;
  if (net < 0) return `−${Math.abs(net).toLocaleString()}`;
  return '0';
}

/** 순증감 숫자 색 — 빠져나감 빨강 · 쌓임 파랑 · 0은 흐리게 */
function netClass(net: number): string {
  if (net < 0) return 'text-admin-danger-text';
  if (net > 0) return 'text-admin-info-text';
  return 'text-admin-muted';
}

/**
 * 01 대여소 이용 현황(#147) — 예전 "히트맵" 탭.
 *
 * 관리자가 관리할 대여소를 고르는 화면이라 **목록이 먼저**다. 고른 **하루**의 대여소별 이용을
 * **빠져나간 곳 순**(순증감 = 반납 − 대여가 작은 순) · 구 전체로 보여 준다(#159). 합계는 붐비는
 * 정도만 알려 줘서, 보충·회수할 곳을 고르는 데는 순증감이 기본이다. 시간대(출근·퇴근 등)를 고르면
 * 그 시간만 더한다 — 하루 합산으로는 출근 유출·퇴근 유입이 상쇄돼 안 보이는 곳이 드러난다.
 * 기간 집계 API가 없어 히트맵 API를 24번 불러 모으므로(#149) 여러 날은 보지 않는다 — 일주일 추이는
 * 대여소 상세의 7일 그래프가 맡는다.
 * 정렬·시간대·구·"상위 100곳"은 받아 온 목록을 화면에서 거른다 — 조건마다 서버를 부르지 않는다.
 * 지도는 같은 조건을 그대로 쓰고, 원 크기는 같게 두고 색 농도로 크기를 나타낸다.
 */
export function AdminStationUsagePage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(DEFAULT_DATE);
  const [sortKey, setSortKey] = useState<SortKey>('deficit');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('all');
  const [district, setDistrict] = useState<District | typeof UNKNOWN_DISTRICT | 'all'>('all');
  const [topOnly, setTopOnly] = useState(false);
  const [view, setView] = useState<View>('list');
  /**
   * 지도 하단 슬라이더의 시(hour) — null이면 하루 전체.
   * 목록은 몇 시간을 묶은 시간대 버튼을, 지도는 한 시간 단위 슬라이더를 쓴다 — 한 시간 숫자는
   * 작아 순위가 흔들리지만, 지도는 시간에 따라 색이 번지는 흐름을 보는 화면이라 잘 맞는다.
   */
  const [mapHour, setMapHour] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
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
    const hours = view === 'map' ? (mapHour === null ? ALL_HOURS : [mapHour]) : hoursOf(timeWindow);
    const sortValue = sortValueOf[sortKey];
    return (
      (data ?? [])
        .filter((usage) => !CONTROL_CENTER_IDS.has(usage.stationId))
        .map((usage): CountedRow => {
          const rentCnt = sumHours(usage.rents, hours);
          const returnCnt = sumHours(usage.returns, hours);
          return {
            ...usage,
            district: STATION_DISTRICT[usage.stationId] ?? UNKNOWN_DISTRICT,
            rentCnt,
            returnCnt,
            totalCnt: rentCnt + returnCnt,
            netCnt: returnCnt - rentCnt,
          };
        })
        // 그 시간대에 기록이 없는 곳은 뺀다 — 하루 내내 0건인 곳이 응답에 없는 것과 같은 기준.
        // 지도 슬라이더의 한 시간은 예외 — 0건도 옅게 남겨야 조용한 시간이 조용하게 보인다
        .filter((row) => row.totalCnt > 0 || (view === 'map' && mapHour !== null))
        .filter((row) => district === 'all' || row.district === district)
        .sort(
          (a, b) => sortValue(b) - sortValue(a) || a.stationName.localeCompare(b.stationName, 'ko'),
        )
        .slice(0, topOnly ? TOP_LIMIT : undefined)
        .map((row, index) => ({ ...row, rank: index + 1 }))
    );
  }, [data, sortKey, timeWindow, view, mapHour, district, topOnly]);

  // 재생 중이면 한 시간씩 넘긴다. 하루 전체에서 누르면 0시부터
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setMapHour((hour) => (hour === null || hour >= 23 ? 0 : hour + 1));
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing]);

  // 순위는 거른 목록 전체 기준이라, 페이지를 넘겨도 51위·52위…로 이어진다
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /** 조건이 바뀌면 목록이 달라지므로 첫 페이지로 돌아간다 */
  const changeSortKey = (key: SortKey) => {
    setSortKey(key);
    setPage(1);
  };

  const rowById = useMemo(() => new Map(rows.map((row) => [row.stationId, row])), [rows]);

  /*
   * 지도 색은 정렬 기준을 따른다 — 순증감 정렬이면 빠져나감 빨강 · 쌓임 파랑(농도 = 순증감 크기),
   * 대여는 대여색, 반납은 반납색, 합계는 합계색
   */
  const deficitColor = readCssToken('--color-admin-heat-deficit');
  const surplusColor = readCssToken('--color-admin-heat-surplus');
  // 순증감 0 — 들어오고 나간 게 같아 손댈 필요 없는 곳은 회색
  const evenColor = readCssToken('--color-admin-muted');
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
        count: isNetSort(sortKey) ? Math.abs(row.netCnt) : sortValueOf[sortKey](row),
        color: !isNetSort(sortKey)
          ? heatColor
          : row.netCnt < 0
            ? deficitColor
            : row.netCnt > 0
              ? surplusColor
              : evenColor,
      })),
    [rows, sortKey, heatColor, deficitColor, surplusColor, evenColor],
  );
  /*
   * 농도 기준(가장 진한 값). 슬라이더로 한 시간을 볼 때는 **하루 중 가장 큰 한 시간 값**으로 고정한다 —
   * 시간마다 그 시간의 최대로 맞추면 새벽 몇 건도 출근 피크만큼 진해져 "밤엔 조용하다"가 안 보인다.
   */
  const maxCount = useMemo(() => {
    if (view === 'map' && mapHour !== null) {
      const ids = new Set(rows.map((row) => row.stationId));
      let max = 0;
      for (const usage of data ?? []) {
        if (!ids.has(usage.stationId)) continue;
        for (const hour of ALL_HOURS) max = Math.max(max, hourValueOf(usage, hour, sortKey));
      }
      return max;
    }
    return Math.max(0, ...cells.map((cell) => cell.count));
  }, [view, mapHour, rows, data, sortKey, cells]);
  const hovered = hover === null ? null : (rowById.get(hover.stationId) ?? null);
  const periodLabel =
    view === 'map'
      ? mapHour === null
        ? '하루 전체'
        : hourLabel(mapHour)
      : TIME_WINDOW_LABEL[timeWindow];

  const openStation = (stationId: string) => navigate(`/admin/stations/${stationId}`);

  /*
   * 구를 고르면 **그 구 전체가 한눈에 보이는 만큼만** 확대한다 — 대전 전체 줌에서는 원이 거의 다
   * 겹쳐서, 관리할 구를 고르면 그 구로 좁혀 보이게 한다. "구 전체"면 전체 대여소에 맞춘다.
   * **구가 바뀔 때만** 맞춘다(지도를 새로 열 때 포함). 날짜·정렬·시간대·상위 100을 바꿀 때마다
   * 맞추면 사용자가 확대해 둔 지도가 튄다.
   */
  const fittedRef = useRef<{ map: naver.maps.Map; district: string } | null>(null);
  useEffect(() => {
    if (map === null || data === undefined) return;
    const fitted = fittedRef.current;
    if (fitted !== null && fitted.map === map && fitted.district === district) return;
    const points = data
      .filter(
        (usage) =>
          !CONTROL_CENTER_IDS.has(usage.stationId) &&
          (district === 'all' ||
            (STATION_DISTRICT[usage.stationId] ?? UNKNOWN_DISTRICT) === district),
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
            {dateValid
              ? `${date} · ${periodLabel} · ${rows.length.toLocaleString()}곳`
              : '날짜를 골라 주세요'}
          </span>
        </div>
        <Segmented
          value={view}
          labels={VIEW_LABEL}
          onChange={(value) => {
            setView(value);
            setPlaying(false);
          }}
          ariaLabel="보기 방식"
        />
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
        {/* 지도는 하단 슬라이더로 시간을 고른다 */}
        {view === 'list' && (
          <Segmented
            value={timeWindow}
            labels={TIME_WINDOW_LABEL}
            onChange={(value) => {
              setTimeWindow(value);
              setPage(1);
            }}
            ariaLabel="시간대"
          />
        )}
        <AdminSelect
          aria-label="정렬 기준"
          value={sortKey}
          onChange={(e) => changeSortKey(e.target.value as SortKey)}
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              {SORT_LABEL[key]}
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
                {/* 누를 때마다 빠져나간 곳 순 ↔ 쌓인 곳 순 */}
                <SortableHeader
                  label="순증감"
                  active={isNetSort(sortKey)}
                  arrow={sortKey === 'surplus' ? '▲' : '▼'}
                  title={isNetSort(sortKey) ? SORT_LABEL[sortKey] : undefined}
                  onClick={() => changeSortKey(sortKey === 'deficit' ? 'surplus' : 'deficit')}
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
                colSpan={7}
                isPending={dateValid && isPending}
                isError={isError}
                onRetry={() => void refetch()}
                isEmpty={rows.length === 0}
                emptyText={
                  dateValid ? '이 날짜·시간대에 이용 기록이 없습니다' : '날짜를 골라 주세요'
                }
              />
              {pageRows.map((row) => (
                <tr key={row.stationId} onClick={() => openStation(row.stationId)}>
                  <td className="tabular-nums text-admin-muted">{row.rank}</td>
                  <td className="truncate">{row.stationName}</td>
                  <td className="text-admin-muted">{row.district}</td>
                  <td className="text-right tabular-nums">{row.rentCnt.toLocaleString()}</td>
                  <td className="text-right tabular-nums">{row.returnCnt.toLocaleString()}</td>
                  <td className={`text-right font-medium tabular-nums ${netClass(row.netCnt)}`}>
                    {formatNet(row.netCnt)}
                  </td>
                  <td className="text-right tabular-nums text-admin-muted">
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
            {isNetSort(sortKey) ? (
              <>
                <LegendDot color={deficitColor} />
                빠져나간 곳(보충)
                <LegendDot color={surplusColor} className="ml-3" />
                쌓인 곳(회수) · 진할수록 많이 · 클릭하면 상세
              </>
            ) : (
              <>
                <LegendDot color={heatColor} />
                진할수록 {COUNT_LABEL[sortKey]} 건수가 많은 대여소 · 클릭하면 상세
              </>
            )}
          </div>

          {/* 커서 미리보기 — 원 바로 위에 띄운다 */}
          {hover && hovered && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-admin-line bg-admin-bg px-3 py-2 text-xs shadow-md"
              style={{ left: hover.x, top: hover.y - 10 }}
            >
              <p className="font-semibold text-admin-text">{hovered.stationName}</p>
              <p className="mt-0.5 text-admin-muted tabular-nums">
                대여 {hovered.rentCnt.toLocaleString()} · 반납 {hovered.returnCnt.toLocaleString()}{' '}
                · 순증감{' '}
                <span className={`font-medium ${netClass(hovered.netCnt)}`}>
                  {formatNet(hovered.netCnt)}
                </span>
              </p>
            </div>
          )}

          {/* 시간 슬라이더 — 한 시간 단위, 재생하면 1초마다 다음 시간. 아래 네이버 저작권·축척을 가리지 않게 띄운다 */}
          <div className="absolute inset-x-3 bottom-9 flex items-center gap-3 rounded-md border border-admin-line bg-admin-bg/95 px-3 py-2">
            <AdminButton
              variant="secondary"
              size="sm"
              aria-label={playing ? '일시정지' : '재생'}
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? '❚❚ 멈춤' : '▶ 재생'}
            </AdminButton>
            <AdminButton
              variant={mapHour === null ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={mapHour === null}
              onClick={() => {
                setPlaying(false);
                setMapHour(null);
              }}
            >
              하루 전체
            </AdminButton>
            <input
              type="range"
              min={0}
              max={23}
              step={1}
              value={mapHour ?? 0}
              aria-label="시간"
              aria-valuetext={periodLabel}
              onChange={(e) => {
                setPlaying(false);
                setMapHour(Number(e.target.value));
              }}
              className={`flex-1 accent-admin-primary ${mapHour === null ? 'opacity-40' : ''}`}
            />
            <span className="w-28 text-right text-sm font-medium tabular-nums">{periodLabel}</span>
          </div>

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

/** 범례의 색 점 */
function LegendDot({ color, className = '' }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-[-1px] ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * 정렬 기준을 바꾸는 표 머리 — 지금 기준이면 굵게 ▼(순증감은 쌓인 곳 순일 때 ▲).
 * 숫자 열이라 오른쪽에 붙인다. 표 공통 스타일(`[&_th]:text-left`)이 th의 text-right를 이겨서
 * 버튼 자체를 오른쪽으로 민다.
 */
function SortableHeader({
  label,
  active,
  onClick,
  arrow = '▼',
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  arrow?: string;
  title?: string;
}) {
  return (
    <th className="w-24 text-right" aria-sort={active ? 'descending' : 'none'}>
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={`flex w-full items-center justify-end gap-1 ${active ? 'font-semibold text-admin-text' : ''}`}
      >
        {label}
        <span aria-hidden className={active ? '' : 'opacity-0'}>
          {arrow}
        </span>
      </button>
    </th>
  );
}

/** 몇 가지 중 하나를 고르는 버튼 묶음(보기 방식 · 시간대) */
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
          className={`px-4 text-sm font-medium whitespace-nowrap transition-colors ${
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
