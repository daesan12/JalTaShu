import { useMemo } from 'react';
import type { RoutePath } from '@/shared/api/types';
import { formatDistance } from '@/shared/lib/format';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { ElevationChart } from '@/shared/ui/ElevationChart';
import { WALK_COLOR } from '@/shared/ui/grade';
import { toStationStatus, type StationStatus } from '@/shared/ui/stationStatus';
import { ROUTE_BADGE } from '@/features/map/lib/routeBadges';
import { buildElevationProfile } from '@/features/map/lib/routeElevation';
import { toLegs } from '@/features/map/lib/routeSegments';
import {
  formatArrival,
  formatMinutes,
  totalAscent,
  type RouteBadgeKind,
  type RouteSummary,
} from '@/features/map/lib/routeMetrics';

/** "도착 시 N대" 색 — 대여소 마커·10 카드와 같은 여유/보통/부족 판정 */
const BIKES_TEXT_CLASS: Record<StationStatus, string> = {
  high: 'text-status-high',
  mid: 'text-status-mid',
  low: 'text-status-low',
};

/** 실제 턴바이턴 안내는 다음 이슈라 지금은 안내만 띄운다 */
const START_LABEL = '안내 시작';

interface RouteDetailSheetProps {
  open: boolean;
  /** 선택한 경로 — 닫히는 동안에도 내용이 남도록 페이지가 마지막 값을 유지한다 */
  route: RoutePath | null;
  summary: RouteSummary | null;
  badge: RouteBadgeKind | null;
  /** 후보를 받은 시각 — 도착 예정 시각 계산용 */
  fetchedAt: number;
  onStart: () => void;
  /** 아래로 끌어도 닫히지 않는다. 닫기는 ← 버튼·뒤로가기 */
  onBack: () => void;
}

/**
 * 11 경로 상세 — 10에서 고른 경로 하나의 요약·고도 그래프·구간 안내.
 * 07 지도 위에 얹는 시트라 라우트를 옮기지 않는다(지도 재생성 방지 규칙).
 */
export function RouteDetailSheet({
  open,
  route,
  summary,
  badge,
  fetchedAt,
  onStart,
  onBack,
}: RouteDetailSheetProps) {
  const profile = useMemo(() => (route === null ? null : buildElevationProfile(route)), [route]);
  const legs = useMemo(() => (route === null ? [] : toLegs(route)), [route]);
  const ascentM = useMemo(() => (route === null ? 0 : totalAscent(route.altitude)), [route]);

  return (
    <BottomSheet open={open} snapPoint="half" onClose={onBack} backdrop={false} dismissible={false}>
      {route === null || summary === null ? null : (
        <div className="flex flex-col gap-4 pb-4">
          {/* 요약 */}
          <div>
            {badge === null ? null : (
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${ROUTE_BADGE[badge].pillClass}`}
              >
                <span
                  aria-hidden
                  className={`h-1 w-3 rounded-full ${ROUTE_BADGE[badge].dotClass}`}
                />
                {ROUTE_BADGE[badge].label}
              </span>
            )}
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-gray-900">
                {formatMinutes(summary.totalSec)}
              </span>
              <span
                className={`text-sm font-semibold ${BIKES_TEXT_CLASS[toStationStatus(summary.expectedBikeCnt)]}`}
              >
                도착 시 <span className="tabular-nums">{summary.expectedBikeCnt}</span>대
              </span>
            </div>
            <p className="mt-0.5 text-sm text-gray-500 tabular-nums">
              {formatArrival(fetchedAt, summary.totalSec)} 도착 예정 · 도보{' '}
              {formatMinutes(summary.walkSec)}
            </p>
          </div>

          {/* 고도 그래프 */}
          {profile === null || profile.bars.length === 0 ? null : (
            <section>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-base font-bold text-gray-900">고도</h2>
                <p className="text-sm text-gray-500 tabular-nums">
                  누적 상승 {ascentM}m · 최대 경사 {profile.maxGradePct}%
                </p>
              </div>
              <div className="mt-3">
                <ElevationChart bars={profile.bars} />
              </div>
            </section>
          )}

          {/* 구간 안내 */}
          <section>
            <h2 className="text-base font-bold text-gray-900">구간 안내</h2>
            <ul className="mt-3 space-y-3.5">
              {legs.map((leg, i) => {
                const isWalk = leg.behave === 'WALK';
                return (
                  <li key={i} className="flex gap-3">
                    <span
                      aria-hidden
                      className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full"
                      style={{ backgroundColor: isWalk ? WALK_COLOR : 'var(--color-primary)' }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-500">{isWalk ? '도보' : '자전거'}</p>
                      <p className="text-base font-bold text-gray-900 tabular-nums">
                        {formatMinutes(leg.timeSec)} · {formatDistance(leg.distanceM)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <Button full onClick={onStart}>
            {START_LABEL}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
