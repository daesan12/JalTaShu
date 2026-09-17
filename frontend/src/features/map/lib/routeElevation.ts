import type { RouteCandidate, RoutePoint } from '@/shared/api/types';
import { haversineMeters, osrmToLatLng } from '@/shared/lib/coords';
import { routePoints } from '@/features/map/lib/routeSegments';
import type { ElevationBar } from '@/shared/ui/ElevationChart';
import type { GradeClass } from '@/shared/ui/grade';

/**
 * 11 고도 그래프 — 경로 좌표를 공용 `ElevationChart`가 받는 막대로 바꾼다.
 *
 * 고도는 **좌표마다** 붙어 온다(`points[].altitude`). 좌표 간격이 들쭉날쭉하므로 막대는 개수가 아니라
 * **누적 거리**를 같은 폭으로 잘라 만든다(가로축이 실제 거리 비율과 맞게).
 */

/** 막대 개수 — 화면 폭(최대 430px)에서 막대가 뭉개지지 않는 선 */
const BAR_COUNT = 24;

/**
 * 경사(%) → 4단계.
 * ⚠ 기준값은 프론트 가정(2026-09-14). 자전거 기준 통념(3%·6%·9%)을 약간 낮춰 잡았다.
 * 색·라벨은 `shared/ui/grade.ts` 검증 통과 값이라 건드리지 않고, 여기서 등급만 정한다.
 */
export function classifyGrade(gradePct: number): GradeClass {
  if (gradePct < 2) return 'flat';
  if (gradePct < 5) return 'gentle';
  if (gradePct < 8) return 'climb';
  return 'steep';
}

export interface ElevationProfile {
  bars: ElevationBar[];
  /** 가장 가파른 막대의 경사(%) — 정수. 오르막만 본다 */
  maxGradePct: number;
}

/** 좌표들의 누적 거리(m). 첫 항목은 0 */
function cumulativeDistances(points: RoutePoint[]): number[] {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    const prev = osrmToLatLng(points[i - 1].location);
    const curr = osrmToLatLng(points[i].location);
    cumulative.push(cumulative[i - 1] + haversineMeters(prev, curr));
  }
  return cumulative;
}

/** 누적 거리 `target`m 지점의 고도 — 앞뒤 좌표를 선형 보간한다 */
function altitudeAt(
  points: RoutePoint[],
  cumulative: number[],
  target: number,
  searchFrom: number,
): { altitude: number; index: number } {
  let i = searchFrom;
  while (i < cumulative.length - 1 && cumulative[i + 1] < target) i++;
  if (i >= cumulative.length - 1) {
    return { altitude: points[points.length - 1].altitude, index: cumulative.length - 1 };
  }
  const span = cumulative[i + 1] - cumulative[i];
  const ratio = span <= 0 ? 0 : (target - cumulative[i]) / span;
  const value =
    points[i].altitude + (points[i + 1].altitude - points[i].altitude) * Math.min(1, ratio);
  return { altitude: value, index: i };
}

/**
 * 경로 좌표 → 막대 24개. 막대 높이는 경로 안에서의 상대 높이(0~1),
 * 색은 그 구간의 평균 경사로 정한 4단계.
 */
export function buildElevationProfile(route: RouteCandidate): ElevationProfile {
  const points = routePoints(route);
  if (points.length < 2) return { bars: [], maxGradePct: 0 };

  const cumulative = cumulativeDistances(points);
  const totalM = cumulative[cumulative.length - 1];
  if (totalM <= 0) return { bars: [], maxGradePct: 0 };

  // 막대 경계 25개(= 막대 24개)를 같은 거리 간격으로 뽑는다
  const stepM = totalM / BAR_COUNT;
  const edges: number[] = [];
  let cursor = 0;
  for (let i = 0; i <= BAR_COUNT; i++) {
    const found = altitudeAt(points, cumulative, stepM * i, cursor);
    cursor = found.index;
    edges.push(found.altitude);
  }

  const min = Math.min(...edges);
  const max = Math.max(...edges);
  const span = max - min;

  let maxGradePct = 0;
  const bars: ElevationBar[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const rise = edges[i + 1] - edges[i];
    const gradePct = (rise / stepM) * 100;
    if (gradePct > maxGradePct) maxGradePct = gradePct;
    // 높이는 구간 양 끝의 평균 고도. 완전 평지면 막대가 사라지지 않게 중간 높이로
    const mid = (edges[i] + edges[i + 1]) / 2;
    bars.push({
      grade: classifyGrade(gradePct),
      value: span <= 0 ? 0.5 : 0.1 + 0.9 * ((mid - min) / span),
    });
  }

  return { bars, maxGradePct: Math.round(maxGradePct) };
}
