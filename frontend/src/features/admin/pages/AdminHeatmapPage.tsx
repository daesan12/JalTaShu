import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { readCssToken } from '@/shared/lib/cssToken';
import { posToLatLng } from '@/shared/lib/coords';
import { getAdminHeatmap } from '@/features/admin/api/adminHeatmap';
import { AdminMap } from '@/features/admin/components/AdminMap';
import { HeatmapLayer, type HeatmapCell } from '@/features/admin/components/HeatmapLayer';
import { AdminButton } from '@/features/admin/ui/AdminButton';
import { AdminDateInput } from '@/features/admin/ui/AdminFilters';

/** 통합 = 순유출입(대여−반납): 유출은 대여색, 유입은 반납색으로 한 화면에 */
type HeatmapMode = 'net' | 'rent' | 'return';

const MODE_ORDER: HeatmapMode[] = ['net', 'rent', 'return'];
const MODE_LABEL: Record<HeatmapMode, string> = { net: '통합', rent: '대여', return: '반납' };

/** 재생 시 시간대가 넘어가는 간격 */
const PLAY_INTERVAL_MS = 1000;
const LAST_HOUR = 23;

/** 오늘을 input[type=date] 값 형식으로 */
function todayString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 01 히트맵(홈) — 날짜·시간대별 대여/반납량을 지도 위 원 크기·농도로 보여준다 */
export function AdminHeatmapPage() {
  const navigate = useNavigate();
  const [map, setMap] = useState<naver.maps.Map | null>(null);
  const [date, setDate] = useState(todayString);
  const [mode, setMode] = useState<HeatmapMode>('net');
  const [hour, setHour] = useState(8);
  const [playing, setPlaying] = useState(false);

  // 서버가 "기준 시각 직전 1시간" 스냅샷만 주므로 시간대마다 다시 부른다.
  // 재생은 캐시(staleTime)와 이전 데이터 유지(placeholderData)로 끊기지 않게 한다
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['adminHeatmap', date, hour],
    queryFn: () => getAdminHeatmap(date, hour),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // 재생 — 1초마다 다음 시간대로, 23시에서 멈춘다
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setHour((prev) => {
        if (prev >= LAST_HOUR) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing]);

  const rentColor = readCssToken('--color-admin-heat-rent');
  const returnColor = readCssToken('--color-admin-heat-return');

  // 모드별 건수: 통합은 |대여−반납|을 크기로, 유출(대여>반납)/유입(반납>대여)을 색으로
  const countOf = useMemo(() => {
    return (point: { rentCnt: number; returnCnt: number }) =>
      mode === 'net'
        ? Math.abs(point.rentCnt - point.returnCnt)
        : mode === 'rent'
          ? point.rentCnt
          : point.returnCnt;
  }, [mode]);

  // 응답이 이미 선택한 시간대의 스냅샷이라 그대로 그린다
  const cells = useMemo<HeatmapCell[]>(
    () =>
      (data ?? []).map((point) => ({
        stationId: point.stationId,
        ...posToLatLng(point),
        count: countOf(point),
        color:
          mode === 'return' || (mode === 'net' && point.returnCnt > point.rentCnt)
            ? returnColor
            : rentColor,
      })),
    [data, mode, countOf, rentColor, returnColor],
  );

  // 크기 기준 — 서버가 시간별 스냅샷만 줘서 하루 최대 고정 스케일은 불가능해졌다.
  // 현재 시간대 최대를 기준으로 삼는다(시간을 옮기면 스케일이 함께 바뀐다)
  const maxCount = useMemo(() => Math.max(0, ...(data ?? []).map(countOf)), [data, countOf]);

  // 실제로 지도에 그려지는 원의 수 — 0건은 HeatmapLayer가 건너뛴다.
  // 응답이 아예 비어도, 통합 모드에서 대여·반납이 상쇄돼도 화면은 똑같이 빈 지도라 따로 센다
  const drawnCount = cells.reduce((count, cell) => (cell.count > 0 ? count + 1 : count), 0);

  // 빈 화면이 "고장"으로 보이지 않게 이유를 적는다 — 응답 자체가 없는 경우와 상쇄된 경우를 구분
  const emptyReason =
    (data ?? []).length === 0
      ? '대여·반납 기록이 없습니다.'
      : mode === 'net'
        ? '대여와 반납이 서로 상쇄돼 표시할 순유출입이 없습니다.'
        : `${MODE_LABEL[mode]} 기록이 없습니다.`;

  // 하단 요약: 통합 모드는 유출·유입을 나눠 보여준다
  const hourSummary = useMemo(() => {
    const points = data ?? [];
    if (mode !== 'net') {
      const total = points.reduce((sum, p) => sum + countOf(p), 0);
      return `${MODE_LABEL[mode]} ${total}건`;
    }
    const outflow = points.reduce((sum, p) => sum + Math.max(0, p.rentCnt - p.returnCnt), 0);
    const inflow = points.reduce((sum, p) => sum + Math.max(0, p.returnCnt - p.rentCnt), 0);
    return `유출 ${outflow} · 유입 ${inflow}건`;
  }, [data, mode, countOf]);

  function togglePlay() {
    // 끝에서 재생을 누르면 처음부터 다시 돈다
    if (!playing && hour >= LAST_HOUR) setHour(0);
    setPlaying((prev) => !prev);
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">전체 대여소 히트맵</h2>
        <div className="flex items-center gap-2">
          <AdminDateInput
            value={date}
            max={todayString()}
            onChange={(e) => setDate(e.target.value)}
            aria-label="조회 날짜"
          />
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </div>

      <div className="relative min-h-[520px] flex-1 overflow-hidden rounded-lg border border-admin-line">
        <AdminMap onReady={setMap} />
        {map && (
          <HeatmapLayer
            map={map}
            cells={cells}
            maxCount={maxCount}
            onSelectStation={(id) => navigate(`/admin/stations/${id}`)}
          />
        )}

        {/* 범례 */}
        <div className="absolute top-3 right-3 rounded-md border border-admin-line bg-admin-bg/95 px-3 py-2 text-xs text-admin-muted">
          {mode === 'net' ? (
            <>
              <LegendDot color={rentColor} />
              유출(대여&gt;반납)
              <LegendDot color={returnColor} className="ml-3" />
              유입(반납&gt;대여) · 원이 클수록 차이 큼 · 클릭하면 상세
            </>
          ) : (
            <>
              <LegendDot color={mode === 'rent' ? rentColor : returnColor} />
              원이 클수록 {MODE_LABEL[mode]} 건수가 많은 대여소 · 클릭하면 상세
            </>
          )}
        </div>

        {isPending && (
          <div className="absolute inset-x-0 top-3 flex justify-center">
            <span className="rounded-md bg-admin-bg/95 px-3 py-1.5 text-xs text-admin-muted">
              불러오는 중…
            </span>
          </div>
        )}
        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-admin-bg/80">
            <p className="text-sm text-admin-muted">히트맵 데이터를 불러오지 못했습니다.</p>
            <AdminButton variant="secondary" size="sm" onClick={() => void refetch()}>
              다시 시도
            </AdminButton>
          </div>
        )}
        {/* 조회는 됐는데 그릴 원이 없을 때 — 지도는 계속 움직일 수 있게 클릭을 통과시킨다 */}
        {!isPending && !isError && drawnCount === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-md border border-admin-line bg-admin-bg/95 px-4 py-3 text-center">
              <p className="text-sm font-medium text-admin-text">
                {hour}시 기준 직전 1시간에 {emptyReason}
              </p>
              <p className="mt-1 text-xs text-admin-muted">앱에서 발생한 대여·반납만 집계합니다.</p>
            </div>
          </div>
        )}
      </div>

      {/* 시간대 컨트롤 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <AdminButton
            variant="secondary"
            size="sm"
            aria-label="이전 시간"
            disabled={hour <= 0}
            onClick={() => setHour((h) => Math.max(0, h - 1))}
          >
            ◀
          </AdminButton>
          <AdminButton size="sm" onClick={togglePlay} className="w-16">
            {playing ? '정지' : '재생'}
          </AdminButton>
          <AdminButton
            variant="secondary"
            size="sm"
            aria-label="다음 시간"
            disabled={hour >= LAST_HOUR}
            onClick={() => setHour((h) => Math.min(LAST_HOUR, h + 1))}
          >
            ▶
          </AdminButton>
        </div>
        <input
          type="range"
          min={0}
          max={LAST_HOUR}
          step={1}
          value={hour}
          onChange={(e) => {
            setPlaying(false);
            setHour(Number(e.target.value));
          }}
          className="flex-1 accent-admin-indicator"
          aria-label="시간대"
        />
        <p className="w-52 text-right text-sm text-admin-text">
          <span className="font-semibold tabular-nums">{hour}시</span>
          <span className="ml-2 text-admin-muted tabular-nums">{hourSummary}</span>
        </p>
      </div>
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

/** 통합/대여/반납 세그먼트 (통합 = 순유출입 뷰) */
function ModeToggle({
  mode,
  onChange,
}: {
  mode: HeatmapMode;
  onChange: (mode: HeatmapMode) => void;
}) {
  return (
    <div className="flex h-9 overflow-hidden rounded-md border border-admin-line" role="group">
      {MODE_ORDER.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          className={`px-4 text-sm font-medium transition-colors ${
            mode === value
              ? 'bg-admin-primary text-white'
              : 'bg-admin-bg text-admin-muted hover:bg-admin-panel'
          }`}
        >
          {MODE_LABEL[value]}
        </button>
      ))}
    </div>
  );
}
