import type { BikeStation } from '@/shared/api/types';
import type { GradeClass } from '@/shared/ui/grade';
import type { ElevationBar } from '@/shared/ui/ElevationChart';
import type { PathSegment } from '@/shared/ui/RouteSketch';
import type {
  UsagePathPoint,
  UsagePoint,
  UsageTravelStatus,
} from '@/features/history/api/rides';

/**
 * 이동 기록 응답(좌표·GPS 경로)을 화면 표현(대여소 이름·경로 그림·고도 그래프·구간 안내)으로
 * 바꾸는 순수 함수들 — 백엔드가 이름·등급을 주지 않아 프론트가 파생한다.
 */

const EARTH_RADIUS_M = 6_371_000;

/** 두 좌표 사이 직선 거리(m) — 하버사인 */
export function distanceMeters(a: UsagePoint, b: UsagePoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** 좌표가 어느 대여소인지 — 응답의 출발/도착 좌표는 대여소 좌표라 가까운 것(100m 이내)을 찾는다 */
const STATION_MATCH_M = 100;

export function stationNameAt(
  point: UsagePoint,
  stations: BikeStation[] | undefined,
): string | null {
  if (!stations || stations.length === 0) return null;
  let best: { name: string; dist: number } | null = null;
  for (const station of stations) {
    const dist = distanceMeters(point, { latitude: station.lat, longitude: station.lng });
    if (dist <= STATION_MATCH_M && (best === null || dist < best.dist)) {
      best = { name: station.name, dist };
    }
  }
  return best?.name ?? null;
}

/** 이름을 못 찾으면 좌표를 사람이 알아볼 수 있는 형태로 */
export function pointLabel(point: UsagePoint, stations: BikeStation[] | undefined): string {
  return stationNameAt(point, stations) ?? `${point.latitude.toFixed(3)}, ${point.longitude.toFixed(3)}`;
}

/** GPS 경로를 이동 수단 순서(WALK1 → BIKE → WALK2)대로 정렬해 나눈다 */
export function splitByTravelStatus(
  road: UsagePathPoint[],
): { status: UsageTravelStatus; points: UsagePathPoint[] }[] {
  const sorted = [...road].sort((a, b) => a.seq - b.seq);
  const groups: { status: UsageTravelStatus; points: UsagePathPoint[] }[] = [];
  for (const point of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.status === point.travelStatus) last.points.push(point);
    else groups.push({ status: point.travelStatus, points: [point] });
  }
  return groups;
}

/** 경사(%) → 4단계 등급. 내리막·평지는 flat */
export function toGradeClass(gradePct: number): GradeClass {
  if (gradePct < 1) return 'flat';
  if (gradePct < 4) return 'gentle';
  if (gradePct < 8) return 'climb';
  return 'steep';
}

/** 연속 좌표 목록의 총 길이(m) */
function pathLengthM(points: UsagePathPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceMeters(points[i - 1], points[i]);
  return total;
}

/**
 * 추상 경로 그림(0~100 공간) — 좌표를 그림 영역에 맞게 정규화하고,
 * 도보 구간은 walk, 자전거 구간은 그 구간의 평균 경사 등급 색을 준다.
 */
export function toSketchPath(road: UsagePathPoint[]): PathSegment[] {
  if (road.length < 2) return [];
  const lats = road.map((p) => p.latitude);
  const lngs = road.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  // 여백 8을 남기고 84×48에 맞춘다. 범위가 0이면(제자리) 가운데 점
  const spanLng = Math.max(maxLng - minLng, 1e-9);
  const spanLat = Math.max(maxLat - minLat, 1e-9);
  const toXY = (p: UsagePathPoint): [number, number] => [
    8 + ((p.longitude - minLng) / spanLng) * 84,
    // 위도는 북쪽이 크지만 SVG y는 아래로 커진다 — 뒤집는다
    8 + (1 - (p.latitude - minLat) / spanLat) * 48,
  ];

  return splitByTravelStatus(road).map((group) => {
    let kind: PathSegment['kind'];
    if (group.status === 'BIKE') {
      const ascent = totalAscentM(group.points);
      const length = pathLengthM(group.points);
      kind = toGradeClass(length > 0 ? (ascent / length) * 100 : 0);
    } else {
      kind = 'walk';
    }
    return { kind, points: group.points.map(toXY) };
  });
}

/** 올라가는 구간만 더한 누적 상승(m) */
export function totalAscentM(points: UsagePathPoint[]): number {
  let ascent = 0;
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].altitude - points[i - 1].altitude;
    if (delta > 0) ascent += delta;
  }
  return Math.round(ascent);
}

const ELEVATION_BAR_COUNT = 16;

/** 고도 그래프 — 경로를 같은 개수의 버킷으로 나눠 상대 높이·경사 등급 막대로 만든다 */
export function toElevationBars(road: UsagePathPoint[]): ElevationBar[] {
  const sorted = [...road].sort((a, b) => a.seq - b.seq);
  if (sorted.length < 2) return [];
  const altitudes = sorted.map((p) => p.altitude);
  const min = Math.min(...altitudes);
  const max = Math.max(...altitudes);
  const span = Math.max(max - min, 1);

  const bars: ElevationBar[] = [];
  for (let i = 0; i < ELEVATION_BAR_COUNT; i++) {
    const start = Math.floor((i * (sorted.length - 1)) / ELEVATION_BAR_COUNT);
    const end = Math.max(start + 1, Math.floor(((i + 1) * (sorted.length - 1)) / ELEVATION_BAR_COUNT));
    const bucket = sorted.slice(start, end + 1);
    const avgAltitude = bucket.reduce((sum, p) => sum + p.altitude, 0) / bucket.length;
    const ascent = totalAscentM(bucket);
    const length = pathLengthM(bucket);
    bars.push({
      grade: toGradeClass(length > 0 ? (ascent / length) * 100 : 0),
      // 최저 고도도 바닥에 붙지 않게 0.12를 깔아 준다
      value: 0.12 + ((avgAltitude - min) / span) * 0.88,
    });
  }
  return bars;
}

/** 경로 전체 최대 경사(%) — 인접 두 점 사이 기울기의 최댓값 */
export function maxGradePct(road: UsagePathPoint[]): number {
  const sorted = [...road].sort((a, b) => a.seq - b.seq);
  let max = 0;
  for (let i = 1; i < sorted.length; i++) {
    const dist = distanceMeters(sorted[i - 1], sorted[i]);
    if (dist < 5) continue; // 제자리 점끼리는 기울기가 튄다
    const grade = ((sorted[i].altitude - sorted[i - 1].altitude) / dist) * 100;
    if (grade > max) max = grade;
  }
  return Math.round(max);
}

export interface UsageSegmentView {
  type: 'walk' | 'bike';
  distanceM: number;
  /** 구간 소요 시간(분) — 시각 정보가 없으면 null */
  durationMin: number | null;
  /** 자전거 구간 전용 */
  ascentM?: number;
  maxGradePct?: number;
}

/**
 * 구간 안내 — WALK1/BIKE/WALK2 구간별 거리·시간.
 * 시간은 대여(자전거 탑승) 시각만 응답에 있어, 도보 두 구간은 남은 시간을 거리 비율로 나눈다.
 */
export function toSegments(
  road: UsagePathPoint[],
  timing: {
    startingDate: string;
    totalDurationSec: number;
    cycleRidingStartTime: string | null;
    cycleRidingEndTime: string | null;
  },
): UsageSegmentView[] {
  const groups = splitByTravelStatus(road);
  const bikeSec =
    timing.cycleRidingStartTime && timing.cycleRidingEndTime
      ? Math.max(
          0,
          (new Date(timing.cycleRidingEndTime).getTime() -
            new Date(timing.cycleRidingStartTime).getTime()) /
            1000,
        )
      : null;
  const walkSecTotal = bikeSec === null ? null : Math.max(0, timing.totalDurationSec - bikeSec);
  const walkDistTotal = groups
    .filter((g) => g.status !== 'BIKE')
    .reduce((sum, g) => sum + pathLengthM(g.points), 0);

  return groups.map((group) => {
    const dist = pathLengthM(group.points);
    if (group.status === 'BIKE') {
      return {
        type: 'bike' as const,
        distanceM: Math.round(dist),
        durationMin: bikeSec === null ? null : Math.max(1, Math.round(bikeSec / 60)),
        ascentM: totalAscentM(group.points),
        maxGradePct: maxGradePct(group.points),
      };
    }
    const share = walkDistTotal > 0 ? dist / walkDistTotal : 0.5;
    return {
      type: 'walk' as const,
      distanceM: Math.round(dist),
      durationMin:
        walkSecTotal === null ? null : Math.max(1, Math.round((walkSecTotal * share) / 60)),
    };
  });
}
